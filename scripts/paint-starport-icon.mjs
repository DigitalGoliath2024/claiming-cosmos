/**
 * White-on-transparent Starport HUD / map icon: docking ring + 4-point star.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 64;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPx(rgba, x, y, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const na = Math.max(rgba[i + 3], a);
  rgba[i] = 255;
  rgba[i + 1] = 255;
  rgba[i + 2] = 255;
  rgba[i + 3] = na;
}

const rgba = Buffer.alloc(SIZE * SIZE * 4);
const cx = (SIZE - 1) / 2;
const cy = (SIZE - 1) / 2;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);

    // Outer docking ring
    if (r > 22 && r < 28) setPx(rgba, x, y, 255);

    // Three docking notches (gaps in the ring filled with short piers)
    const notch = Math.abs((((ang + Math.PI) * 3) / (Math.PI * 2)) % 1 - 0.5);
    if (r > 18 && r < 30 && notch < 0.08) setPx(rgba, x, y, 255);

    // Inner pad
    if (r > 8 && r < 12) setPx(rgba, x, y, 255);

    // 4-point star in the well
    const diamond = Math.abs(dx) + Math.abs(dy);
    if (diamond < 7) setPx(rgba, x, y, 255);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 11) setPx(rgba, x, y, 255);
    if (Math.abs(dy) < 2 && Math.abs(dx) < 11) setPx(rgba, x, y, 255);
  }
}

const out = path.join(root, "resources/images/StarportIconWhite.png");
fs.writeFileSync(out, encodePng(SIZE, SIZE, rgba));
console.log("wrote", out);
