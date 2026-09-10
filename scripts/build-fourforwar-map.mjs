/**
 * Paints Four for War image.png from four corner worlds and a rock belt.
 *
 * Black space → water 106. Every planet has seas — all non-void blue is
 * lake water (not only blue that touches green). Asteroids stay rocky land.
 * Never emit #000000 walls.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "map-generator/assets/maps/_fourforwar-color.png");
const OUT_DIR = path.join(root, "map-generator/assets/maps/fourforwar");
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

function chromaOf(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isLava(r, g, b) {
  return r >= 100 && r >= g + 25 && r >= b + 50 && b < 90;
}

function isBlueWater(r, g, b) {
  return b >= 50 && b > r + 20 && b >= g - 8 && r < 90;
}

function isGreen(r, g, b) {
  return g >= 55 && g > r + 8 && g > b + 8;
}

/** True black void only — asteroids sit at lum ~20–55. */
function isSpaceLike(r, g, b) {
  if (isLava(r, g, b) || isBlueWater(r, g, b) || isGreen(r, g, b)) return false;
  return lumOf(r, g, b) <= 16;
}

function landBlue(r, g, b) {
  const lum = lumOf(r, g, b);
  if (isLava(r, g, b)) {
    const t = Math.min(1, (r - 100) / 155);
    return 210 + Math.round(t * 40);
  }
  if (isGreen(r, g, b)) {
    const t = Math.min(1, (g - 55) / 160);
    return 140 + Math.round(t * 38);
  }
  if (
    r >= 90 &&
    g >= 70 &&
    r - b >= 40 &&
    g - b >= 25 &&
    r - g < 50 &&
    b < 120
  ) {
    const t = Math.min(1, lum / 200);
    return 148 + Math.round(t * 20);
  }
  if (lum >= 165 && Math.abs(r - g) < 25 && Math.abs(g - b) < 30) {
    const t = Math.min(1, (lum - 165) / 90);
    return 179 + Math.round(t * 30);
  }
  const t = Math.min(1, Math.max(0, (lum - 20) / 180));
  return 110 + Math.round(t * 29);
}

function floodVoid(rgba, w, h) {
  const n = w * h;
  const voidMask = new Uint8Array(n);
  const q = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const tryPush = (i) => {
    if (voidMask[i]) return;
    const o = i * 4;
    if (!isSpaceLike(rgba[o], rgba[o + 1], rgba[o + 2])) return;
    voidMask[i] = 1;
    q[tail++] = i;
  };

  for (let x = 0; x < w; x++) {
    tryPush(x);
    tryPush((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    tryPush(y * w);
    tryPush(y * w + (w - 1));
  }

  while (head < tail) {
    const i = q[head++];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) tryPush(i - 1);
    if (x + 1 < w) tryPush(i + 1);
    if (y > 0) tryPush(i - w);
    if (y + 1 < h) tryPush(i + w);
  }

  return voidMask;
}

/** All four worlds have seas — any blue not open void is a lake candidate. */
function floodPlanetOceans(rgba, w, h, voidMask) {
  const n = w * h;
  const ocean = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (voidMask[i]) continue;
    const o = i * 4;
    if (isBlueWater(rgba[o], rgba[o + 1], rgba[o + 2])) ocean[i] = 1;
  }
  return ocean;
}

/**
 * Planet seas were leaking into the void through anti-aliased rims, so they
 * packed as open ocean (black space). Convert blue that touches void into
 * shore land until every sea is fully enclosed.
 */
function sealLakesFromVoid(oceanMask, voidMask, w, h) {
  const n = w * h;
  let sealed = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const kill = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!oceanMask[i]) continue;
        const touchVoid =
          (x > 0 && voidMask[i - 1]) ||
          (x + 1 < w && voidMask[i + 1]) ||
          (y > 0 && voidMask[i - w]) ||
          (y + 1 < h && voidMask[i + w]);
        if (touchVoid) kill[i] = 1;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!kill[i]) continue;
      oceanMask[i] = 0;
      sealed++;
      changed = true;
    }
  }
  return sealed;
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

const src = decodePng(fs.readFileSync(SRC));
const { w, h, rgba } = src;
const voidMask = floodVoid(rgba, w, h);
const oceanMask = floodPlanetOceans(rgba, w, h, voidMask);
const sealed = sealLakesFromVoid(oceanMask, voidMask, w, h);
const outW = w * SCALE;
const outH = h * SCALE;
const out = Buffer.alloc(outW * outH * 4);
const landMask = new Uint8Array(outW * outH);
const counts = { water: 0, rocky: 0, terra: 0, ice: 0, lava: 0, sealed };

for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const sx = Math.min(w - 1, Math.floor(x / SCALE));
    const sy = Math.min(h - 1, Math.floor(y / SCALE));
    const si = sy * w + sx;
    const o = si * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const water = voidMask[si] || oceanMask[si];
    const blue = water ? WATER_BLUE : landBlue(r, g, b);
    const di = (y * outW + x) * 4;
    out[di] = 0;
    out[di + 1] = 0;
    out[di + 2] = blue;
    out[di + 3] = 255;
    if (blue === WATER_BLUE) {
      counts.water++;
    } else {
      landMask[x + y * outW] = 1;
      if (blue <= 139) counts.rocky++;
      else if (blue <= 178) counts.terra++;
      else if (blue <= 209) counts.ice++;
      else counts.lava++;
    }
  }
}

// At output scale, close any rim leaks so planet seas stay lakes (not void).
{
  const n = outW * outH;
  const isWater = (i) => out[i * 4 + 2] === WATER_BLUE;
  let sealedOut = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const voidVis = new Uint8Array(n);
    const q = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const push = (i) => {
      if (voidVis[i] || !isWater(i)) return;
      voidVis[i] = 1;
      q[tail++] = i;
    };
    for (let x = 0; x < outW; x++) {
      push(x);
      push((outH - 1) * outW + x);
    }
    for (let y = 0; y < outH; y++) {
      push(y * outW);
      push(y * outW + (outW - 1));
    }
    while (head < tail) {
      const i = q[head++];
      const x = i % outW;
      const y = (i / outW) | 0;
      if (x > 0) push(i - 1);
      if (x + 1 < outW) push(i + 1);
      if (y > 0) push(i - outW);
      if (y + 1 < outH) push(i + outW);
    }
    const kill = new Uint8Array(n);
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const i = y * outW + x;
        if (!isWater(i) || voidVis[i]) continue;
        const touchVoid =
          (x > 0 && voidVis[i - 1]) ||
          (x + 1 < outW && voidVis[i + 1]) ||
          (y > 0 && voidVis[i - outW]) ||
          (y + 1 < outH && voidVis[i + outW]);
        if (touchVoid) kill[i] = 1;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!kill[i]) continue;
      // Rocky shore — closes the planet so seas stay enclosed lakes.
      out[i * 4] = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 125;
      out[i * 4 + 3] = 255;
      landMask[i] = 1;
      sealedOut++;
      counts.water--;
      counts.rocky++;
      changed = true;
    }
  }
  counts.sealedOut = sealedOut;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "image.png"), encodePng(outW, outH, out));
const islands = largestIslands(landMask, outW, outH, 400, 24);
console.log({
  source: `${w}x${h}`,
  out: `${outW}x${outH}`,
  counts,
  islands,
});
