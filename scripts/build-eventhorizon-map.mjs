/**
 * Paints Event Horizon image.png from the dark stone ring art.
 *
 * Absolute black (inside the hole and outside the ring) → water 106 so
 * Voidships can fly through the center and around the rim. The textured
 * ring is rocky land. Never emit #000000 walls.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "map-generator/assets/maps/_eventhorizon-color.png");
const OUT_DIR = path.join(root, "map-generator/assets/maps/eventhorizon");
const SCALE = 2;
const WATER_BLUE = 106;

function paeth(a, b, c) {
  const x = a + b - c;
  const pa = Math.abs(x - a);
  const pb = Math.abs(x - b);
  const pc = Math.abs(x - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  let off = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idats = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === "IDAT") idats.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = w * bpp;
  const rgba = Buffer.alloc(w * h * 4);
  let src = 0;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[src++];
    raw.copy(cur, 0, src, src + stride);
    src += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 1) cur[i] = (cur[i] + left) & 255;
      else if (filter === 2) cur[i] = (cur[i] + up) & 255;
      else if (filter === 3)
        cur[i] = (cur[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) cur[i] = (cur[i] + paeth(left, up, upLeft)) & 255;
    }
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      const si = x * bpp;
      rgba[di] = cur[si];
      rgba[di + 1] = cur[si + 1];
      rgba[di + 2] = cur[si + 2];
      rgba[di + 3] = bpp === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, rgba };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td), 0);
    chunks.push(len, td, crc);
  }
  chunk("IHDR", ihdr);
  chunk("IDAT", compressed);
  chunk("IEND", Buffer.alloc(0));
  return Buffer.concat(chunks);
}

function lumOf(r, g, b) {
  return (r + g + b) / 3;
}

/** Pitch black void — ring stone sits around lum 60–100. */
function isSpaceLike(r, g, b) {
  return lumOf(r, g, b) <= 18;
}

function landBlue(r, g, b) {
  const lum = lumOf(r, g, b);
  const t = Math.min(1, Math.max(0, (lum - 20) / 100));
  return 110 + Math.round(t * 29);
}

function largestIslands(land, w, h, minSize, limit) {
  const vis = new Uint8Array(w * h);
  const blobs = [];
  const idx = (x, y) => x + y * w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!land[i] || vis[i]) continue;
      const q = [[x, y]];
      vis[i] = 1;
      let sx = 0;
      let sy = 0;
      let n = 0;
      while (q.length) {
        const [px, py] = q.pop();
        sx += px;
        sy += py;
        n++;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = idx(nx, ny);
          if (!land[ni] || vis[ni]) continue;
          vis[ni] = 1;
          q.push([nx, ny]);
        }
      }
      if (n >= minSize) {
        blobs.push({ n, x: Math.round(sx / n), y: Math.round(sy / n) });
      }
    }
  }
  blobs.sort((a, b) => b.n - a.n);
  return blobs.slice(0, limit);
}

/** Spread spawn points around the ring (not the centroid, which is the hole). */
function ringSpawns(land, w, h, count) {
  const pts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (land[x + y * w]) pts.push([x, y]);
    }
  }
  if (pts.length === 0) return [];
  const cx = w / 2;
  const cy = h / 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count - Math.PI / 2;
    const tx = cx + Math.cos(ang) * (Math.min(w, h) * 0.38);
    const ty = cy + Math.sin(ang) * (Math.min(w, h) * 0.38);
    let best = pts[0];
    let bestD = Infinity;
    for (const p of pts) {
      const d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    out.push({ x: best[0], y: best[1] });
  }
  return out;
}

const src = decodePng(fs.readFileSync(SRC));
const { w, h, rgba } = src;
const outW = w * SCALE;
const outH = h * SCALE;
const out = Buffer.alloc(outW * outH * 4);
const landMask = new Uint8Array(outW * outH);
const counts = { water: 0, rocky: 0 };

for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const sx = Math.min(w - 1, Math.floor(x / SCALE));
    const sy = Math.min(h - 1, Math.floor(y / SCALE));
    const o = (sy * w + sx) * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const water = isSpaceLike(r, g, b);
    const blue = water ? WATER_BLUE : landBlue(r, g, b);
    const di = (y * outW + x) * 4;
    out[di] = 0;
    out[di + 1] = 0;
    out[di + 2] = blue;
    out[di + 3] = 255;
    if (blue === WATER_BLUE) counts.water++;
    else {
      landMask[x + y * outW] = 1;
      counts.rocky++;
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "image.png"), encodePng(outW, outH, out));
const islands = largestIslands(landMask, outW, outH, 400, 8);
const spawns = ringSpawns(landMask, outW, outH, 12);
console.log({
  source: `${w}x${h}`,
  out: `${outW}x${outH}`,
  counts,
  islands,
  spawns,
});
