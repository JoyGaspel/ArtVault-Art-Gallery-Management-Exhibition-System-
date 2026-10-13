// Regenerate the three manuscript charts from a sanitized aggregate JSON file.
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const input = process.argv[2];
const outputDirectory = process.argv[3];
if (!input || !outputDirectory) {
  console.error('Usage: node scripts/render-manuscript-charts.js <aggregate.json> <output-directory>');
  process.exit(1);
}

const xml = (value) => String(value).replace(/[<>&"']/g, (char) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
}[char]));

function chart(title, rows, footer) {
  const max = Math.max(...rows.map((row) => row[1]), 1);
  const bars = rows.map(([label, value], index) => {
    const y = 170 + index * 70;
    const width = Math.round((value / max) * 1040);
    return `
      <text x="60" y="${y + 33}" class="label">${xml(label)}</text>
      <rect x="470" y="${y}" width="1040" height="44" rx="10" fill="#f4effb"/>
      <rect x="470" y="${y}" width="${width}" height="44" rx="10" fill="#6b4db0"/>
      <text x="1530" y="${y + 33}" class="value">${value}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="900" viewBox="0 0 1700 900">
    <style>
      .title { font: bold 48px Arial, sans-serif; fill: #261d3d; }
      .label { font: 30px Arial, sans-serif; fill: #261d3d; }
      .value { font: bold 30px Arial, sans-serif; fill: #261d3d; }
      .foot { font: 23px Arial, sans-serif; fill: #625b70; }
    </style>
    <rect width="1700" height="900" fill="white"/>
    <text x="60" y="84" class="title">${xml(title)}</text>
    <rect x="60" y="107" width="1580" height="4" fill="#6b4db0"/>
    ${bars}
    <text x="64" y="840" class="foot">${xml(footer)}</text>
  </svg>`;
}

async function main() {
  const data = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
  const categories = Object.entries(data.artworkCategories).sort((a, b) => b[1] - a[1]);
  const likes = [['0 likes', data.likesPerArtworkBins['0']],
    ['1 like', data.likesPerArtworkBins['1']],
    ['2 likes', data.likesPerArtworkBins['2']],
    ['3+ likes', data.likesPerArtworkBins['3+']]];
  const actions = [['Update', data.auditAction.update],
    ['Create', data.auditAction.create],
    ['Delete', data.auditAction.delete],
    ['Account delete', data.auditAction.account_delete],
    ['Permanent delete', data.auditAction.permanent_delete]];
  const output = path.resolve(outputDirectory);
  await fs.mkdir(output, { recursive: true });
  const figures = [
    ['image4.png', chart('Artworks by category (multi-label)', categories,
      `A single artwork can carry multiple categories; bars do not sum to ${data.counts.artworks}.`)],
    ['image5.png', chart('Distribution of likes per artwork', likes,
      `${data.counts.artworks} artworks; ${data.counts.likes} like records in the October 13 live snapshot.`)],
    ['image6.png', chart('Audit activity by action', actions,
      `${data.counts.auditLogs} recorded actions. Counts show workload, not correctness or misconduct.`)],
  ];
  await Promise.all(figures.map(async ([filename, svg]) => {
    await sharp(Buffer.from(svg)).png().toFile(path.join(output, filename));
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
