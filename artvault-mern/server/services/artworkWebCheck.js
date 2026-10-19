const sharp = require('sharp');

// A web match is a review signal, never a finding that an artist copied work.
async function checkArtworkOnWeb(imageDataUrl) {
  if (process.env.ARTWORK_WEB_CHECK_ENABLED !== 'true') return { status: 'disabled', urls: [] };
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return { status: 'unavailable', urls: [] };
  try {
    const source = Buffer.from(imageDataUrl.split(',')[1], 'base64');
    const image = await sharp(source, { animated: false }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: image.toString('base64') }, features: [{ type: 'WEB_DETECTION' }] }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { status: 'unavailable', urls: [] };
    const data = await response.json();
    const result = data.responses?.[0];
    if (!result || result.error) return { status: 'unavailable', urls: [] };
    const matches = [...(result.webDetection?.fullMatchingImages || []), ...(result.webDetection?.partialMatchingImages || [])];
    const urls = [...new Set(matches.map((match) => match.url).filter((url) => {
      try { return new URL(url).protocol === 'https:'; } catch { return false; }
    }))].slice(0, 10);
    return { status: matches.length ? 'possible_match' : 'no_match', urls };
  } catch {
    return { status: 'unavailable', urls: [] };
  }
}

module.exports = { checkArtworkOnWeb };
