const sharp = require('sharp');
const classifier = require('./localContentClassifier');

const classes = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'];
const failure = () => Object.assign(new Error('Content safety checking is unavailable or busy. Please try uploading again later.'), { status: 503 });

// Always server-side, local and fail-closed. No API key or remote image transfer.
async function requireSafeArtworkImages(images) {
  for (const dataUrl of images) {
    let pixels;
    try {
      const source = Buffer.from(dataUrl.split(',')[1], 'base64');
      const metadata = await sharp(source).metadata();
      if ((metadata.pages || 1) > 1) {
        throw Object.assign(new Error('Animated images are not accepted. Upload a still PNG, JPG, WebP, or GIF image.'), { status: 400 });
      }
      pixels = await sharp(source).rotate().resize(224, 224, { fit: 'fill' })
        .flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha().raw().toBuffer();
    } catch (error) {
      if (error.status) throw error;
      throw Object.assign(new Error('The image could not be decoded. Choose another image.'), { status: 400 });
    }
    let predictions;
    try { predictions = await classifier.classify(pixels); } catch { throw failure(); }
    if (!Array.isArray(predictions) || predictions.length !== 5
      || new Set(predictions.map((item) => item?.className)).size !== 5
      || predictions.some((item) => !classes.includes(item?.className) || !Number.isFinite(item.probability) || item.probability < 0 || item.probability > 1)
      || Math.abs(predictions.reduce((sum, item) => sum + item.probability, 0) - 1) > 0.02) throw failure();
    const scores = Object.fromEntries(predictions.map((item) => [item.className, item.probability]));
    if (scores.Porn >= 0.20 || scores.Hentai >= 0.20 || scores.Sexy >= 0.40
      || scores.Porn + scores.Hentai + scores.Sexy >= 0.45) {
      throw Object.assign(new Error('Upload blocked: artwork and ownership proof must not contain nudity, pornography, or sexually suggestive content. If this seems incorrect, contact an administrator.'), { status: 422 });
    }
  }
}

module.exports = { requireSafeArtworkImages };
