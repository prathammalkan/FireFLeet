// generate-icons.mjs
// Generates PWA icons as SVGs (browsers support SVG icons in manifests)
// For best PWA support, these should be PNG — use a real design tool later

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');

mkdirSync(outDir, { recursive: true });

function makeSVG(size) {
  const pad = Math.round(size * 0.15);
  const radius = Math.round(size * 0.22);
  const flameX = size / 2;
  const flameY = size / 2;
  const flameSize = Math.round(size * 0.42);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a24"/>
      <stop offset="100%" stop-color="#0a0a0f"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <!-- Flame icon (simplified) -->
  <text
    x="${flameX}"
    y="${flameY + flameSize * 0.38}"
    font-size="${flameSize}"
    text-anchor="middle"
    dominant-baseline="middle"
  >🔥</text>
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const svg = makeSVG(size);
  writeFileSync(join(outDir, `icon-${size}x${size}.svg`), svg);
  console.log(`✓ icon-${size}x${size}.svg`);
}

// Also write a simple PNG substitute using a base64 encoded 1x1 orange pixel
// scaled up — for manifest compatibility
// In production, replace with real PNGs generated from the SVG above

console.log('\n✅ SVG icons generated in public/icons/');
console.log('⚠️  For production: convert SVGs to PNGs using squoosh.app or ImageMagick');
console.log('   Command: for f in public/icons/*.svg; do convert "$f" "${f%.svg}.png"; done');
