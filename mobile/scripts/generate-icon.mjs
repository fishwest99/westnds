/* eslint-disable no-undef */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public");

const buildSvg = (size) => {
  const w = size;
  const h = size;
  const fontSize = Math.round(size * 0.18);
  const radius = Math.round(size * 0.22);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#1E3A8A"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-weight="800"
    font-size="${fontSize}"
    fill="#ffffff"
    letter-spacing="-1">West NDx</text>
</svg>`;
};

async function makePng(size, filename) {
  const svg = buildSvg(size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(path.join(PUBLIC_DIR, filename), buf);
  console.log("wrote", filename, buf.length, "bytes");
}

async function makeFavicon() {
  const svg = buildSvg(48);
  const buf = await sharp(Buffer.from(svg)).resize(48, 48).png().toBuffer();
  await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), buf);
  console.log("wrote favicon.ico", buf.length, "bytes");
}

await makePng(192, "icon-192.png");
await makePng(512, "icon-512.png");
await makePng(180, "apple-touch-icon.png");
await makeFavicon();
console.log("done");
