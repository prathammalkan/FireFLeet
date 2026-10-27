// generate-icons.mjs
// Generates the branded SVG and PNG icon sets used by the PWA manifest.

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');

mkdirSync(outDir, { recursive: true });

function makeSVG(size) {
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

// Small dependency-free PNG encoder for installable manifest icons.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function makePNG(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const outerFlame = [[0.5, 0.2], [0.64, 0.4], [0.61, 0.55], [0.75, 0.69], [0.7, 0.86], [0.58, 0.94], [0.42, 0.94], [0.3, 0.84], [0.27, 0.69], [0.39, 0.53], [0.37, 0.39]];
  const innerFlame = [[0.5, 0.49], [0.59, 0.63], [0.57, 0.74], [0.65, 0.8], [0.58, 0.9], [0.42, 0.9], [0.37, 0.81], [0.43, 0.7]];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
      const cornerRadius = 0.22;
      const cornerX = nx < cornerRadius ? cornerRadius - nx : nx > 1 - cornerRadius ? nx - (1 - cornerRadius) : 0;
      const cornerY = ny < cornerRadius ? cornerRadius - ny : ny > 1 - cornerRadius ? ny - (1 - cornerRadius) : 0;
      const rounded = cornerX * cornerX + cornerY * cornerY <= cornerRadius * cornerRadius;
      const offset = (y * size + x) * 4;

      if (!rounded || edge <= 0) {
        pixels[offset + 3] = 0;
        continue;
      }

      const mix = (nx + ny) / 2;
      pixels[offset] = Math.round(26 - mix * 16);
      pixels[offset + 1] = Math.round(26 - mix * 26);
      pixels[offset + 2] = Math.round(36 - mix * 21);
      pixels[offset + 3] = 255;

      if (pointInPolygon(nx, ny, outerFlame)) {
        pixels[offset] = 249;
        pixels[offset + 1] = 115;
        pixels[offset + 2] = 22;
      }
      if (pointInPolygon(nx, ny, innerFlame)) {
        pixels[offset] = 254;
        pixels[offset + 1] = 202;
        pixels[offset + 2] = 32;
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    rows.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const svg = makeSVG(size);
  writeFileSync(join(outDir, `icon-${size}x${size}.svg`), svg);
  console.log(`✓ icon-${size}x${size}.svg`);
}

for (const size of sizes) {
  writeFileSync(join(outDir, `icon-${size}x${size}.png`), makePNG(size));
  console.log(`✓ icon-${size}x${size}.png`);
}

console.log('\n✅ SVG and PNG icons generated in public/icons/');
