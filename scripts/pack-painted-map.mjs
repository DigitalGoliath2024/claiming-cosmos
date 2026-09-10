/**
 * Node stand-in for `go run . --maps=<name>` when the Go toolchain isn't
 * installed. Matches map-generator packing, ocean/lake rules, and biome.bin.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const LAND = 0;
const WATER = 1;
const minIslandSize = 30;
const minLakeSize = 200;

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

function landPaintFromBlue(blue) {
  if (blue >= 110 && blue <= 139) {
    return { mag: Math.min(30, Math.round(((blue - 110) * 30) / 29)), biome: 0 };
  }
  if (blue >= 140 && blue <= 178) {
    return { mag: Math.min(30, Math.round(((blue - 140) * 30) / 38)), biome: 1 };
  }
  if (blue >= 179 && blue <= 209) {
    return { mag: Math.min(30, Math.round(((blue - 179) * 30) / 30)), biome: 2 };
  }
  if (blue >= 210) {
    const bb = Math.min(blue, 250);
    return { mag: Math.min(30, Math.round(((bb - 210) * 30) / 40)), biome: 3 };
  }
  return { mag: 0, biome: 0 };
}

function idx(x, y, h) {
  return x * h + y;
}

function neighbors(x, y, w, h) {
  const out = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < w - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < h - 1) out.push([x, y + 1]);
  return out;
}

function getArea(sx, sy, terrain, visited, w, h) {
  const target = terrain[idx(sx, sy, h)].type;
  const area = [];
  const q = [[sx, sy]];
  visited[idx(sx, sy, h)] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    if (terrain[idx(x, y, h)].type !== target) continue;
    area.push([x, y]);
    for (const [nx, ny] of neighbors(x, y, w, h)) {
      const ni = idx(nx, ny, h);
      if (!visited[ni]) {
        visited[ni] = 1;
        q.push([nx, ny]);
      }
    }
  }
  return area;
}

function removeSmallIslands(terrain, w, h, minSize) {
  const visited = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (terrain[idx(x, y, h)].type !== LAND || visited[idx(x, y, h)]) continue;
      const area = getArea(x, y, terrain, visited, w, h);
      if (area.length < minSize) {
        for (const [ax, ay] of area) {
          const t = terrain[idx(ax, ay, h)];
          t.type = WATER;
          t.mag = 0;
          t.biome = 255;
          t.ocean = false;
          t.shore = false;
        }
      }
    }
  }
}

function processShore(terrain, w, h) {
  const shorelineWaters = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const t = terrain[idx(x, y, h)];
      t.shore = false;
      if (t.type === LAND) {
        for (const [nx, ny] of neighbors(x, y, w, h)) {
          if (terrain[idx(nx, ny, h)].type === WATER) {
            t.shore = true;
            break;
          }
        }
      } else if (t.type === WATER) {
        for (const [nx, ny] of neighbors(x, y, w, h)) {
          if (terrain[idx(nx, ny, h)].type === LAND) {
            t.shore = true;
            shorelineWaters.push([x, y]);
            break;
          }
        }
      }
    }
  }
  return shorelineWaters;
}

function processDistToLand(shorelineWaters, terrain, w, h) {
  const visited = new Uint8Array(w * h);
  const q = [];
  let head = 0;
  for (const [x, y] of shorelineWaters) {
    q.push([x, y, 0]);
    visited[idx(x, y, h)] = 1;
    terrain[idx(x, y, h)].mag = 0;
  }
  while (head < q.length) {
    const [x, y, dist] = q[head++];
    for (const [nx, ny] of neighbors(x, y, w, h)) {
      const ni = idx(nx, ny, h);
      if (visited[ni] || terrain[ni].type !== WATER) continue;
      visited[ni] = 1;
      terrain[ni].mag = dist + 1;
      q.push([nx, ny, dist + 1]);
    }
  }
}

function processWater(terrain, w, h, removeSmall, opts = {}) {
  for (let i = 0; i < terrain.length; i++) terrain[i].ocean = false;
  const visited = new Uint8Array(w * h);
  const bodies = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (terrain[idx(x, y, h)].type !== WATER || visited[idx(x, y, h)]) continue;
      bodies.push(getArea(x, y, terrain, visited, w, h));
    }
  }
  bodies.sort((a, b) => b.length - a.length);
  if (bodies.length === 0) return;

  // Event Horizon: outer void AND the hole must both be open void.
  if (opts.allOcean) {
    for (const t of terrain) {
      if (t.type === WATER) t.ocean = true;
    }
  } else {
    // Open void / sea = water that touches the map edge. Enclosed seas are lakes.
    const edgeOcean = new Uint8Array(w * h);
    const q = [];
    const tryPush = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = idx(x, y, h);
      if (edgeOcean[i] || terrain[i].type !== WATER) return;
      edgeOcean[i] = 1;
      q.push([x, y]);
    };
    for (let x = 0; x < w; x++) {
      tryPush(x, 0);
      tryPush(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryPush(0, y);
      tryPush(w - 1, y);
    }
    for (let qi = 0; qi < q.length; qi++) {
      const [x, y] = q[qi];
      tryPush(x - 1, y);
      tryPush(x + 1, y);
      tryPush(x, y - 1);
      tryPush(x, y + 1);
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (edgeOcean[idx(x, y, h)]) terrain[idx(x, y, h)].ocean = true;
      }
    }
  }

  if (removeSmall) {
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.length >= minLakeSize) continue;
      // Never delete open void; only tiny enclosed puddles.
      if (terrain[idx(body[0][0], body[0][1], h)].ocean) continue;
      for (const [x, y] of body) {
        const t = terrain[idx(x, y, h)];
        t.type = LAND;
        t.mag = 0;
        t.biome = 0;
        t.ocean = false;
      }
    }
  }
  const shores = processShore(terrain, w, h);
  processDistToLand(shores, terrain, w, h);
}

function createMiniMap(terrain, w, h) {
  const mw = (w / 2) | 0;
  const mh = (h / 2) | 0;
  const mini = Array.from({ length: mw * mh }, () => ({
    type: LAND,
    mag: 0,
    biome: 0,
    ocean: false,
    shore: false,
    filled: false,
  }));
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const mx = (x / 2) | 0;
      const my = (y / 2) | 0;
      if (mx >= mw || my >= mh) continue;
      const src = terrain[idx(x, y, h)];
      const dst = mini[idx(mx, my, mh)];
      if (dst.type === WATER) continue;
      if (!dst.filled) {
        Object.assign(dst, src, { filled: true });
        continue;
      }
      if (src.type === WATER) {
        Object.assign(dst, src, { filled: true });
      }
    }
  }
  for (const t of mini) delete t.filled;
  return { terrain: mini, w: mw, h: mh };
}

function packTerrain(terrain, w, h) {
  const packed = Buffer.alloc(w * h);
  let numLandTiles = 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const t = terrain[idx(x, y, h)];
      let b = 0;
      if (t.type === LAND) {
        b |= 0b10000000;
        numLandTiles++;
      }
      if (t.shore) b |= 0b01000000;
      if (t.ocean) b |= 0b00100000;
      if (t.type === LAND) b |= Math.min(Math.ceil(t.mag), 31);
      else b |= Math.min(Math.ceil(t.mag / 2), 31);
      packed[y * w + x] = b;
    }
  }
  return { packed, numLandTiles };
}

function packBiome(terrain, w, h) {
  const out = Buffer.alloc(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const t = terrain[idx(x, y, h)];
      out[y * w + x] = t.type !== LAND ? 255 : t.biome;
    }
  }
  return out;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, v));
}

function thumbColor(t) {
  let mag = t.mag | 0;
  if (mag < 0) mag = 0;
  if (t.type === WATER) {
    if (t.shore) return [80, 80, 84, 255];
    const m = Math.min(mag, 10);
    return [Math.max(0, 5 - m), Math.max(0, 5 - m), Math.max(0, 10 - m), 255];
  }
  if (t.shore) return [138, 132, 124, 255];
  let look = t.biome;
  if (look === 255) look = mag < 20 ? 1 : 2;
  const m = mag % 10;
  if (look === 0) return [168, Math.max(0, 136 - 2 * m), 112, 255];
  if (look === 3) {
    return [clampByte(154 + 14 * m), clampByte(46 + 6 * m), clampByte(24 + 2 * m), 255];
  }
  if (look === 2) {
    return [clampByte(212 + 2 * m), clampByte(220 + 2 * m), clampByte(232 + 2 * m), 255];
  }
  if (mag < 10) return [126, Math.max(0, 217 - 2 * mag), 87, 255];
  const hm = mag - 10;
  return [clampByte(232 + 2 * hm), clampByte(180 + 2 * hm), clampByte(90 + 2 * hm), 255];
}

function createThumbnail(terrain, w, h, quality) {
  const tw = Math.max(1, Math.floor(w * quality));
  const th = Math.max(1, Math.floor(h * quality));
  const rgba = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(w - 1, Math.floor(x / quality));
      const sy = Math.min(h - 1, Math.floor(y / quality));
      const [r, g, b, a] = thumbColor(terrain[idx(sx, sy, h)]);
      const o = (y * tw + x) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = a;
    }
  }
  return { w: tw, h: th, rgba };
}

const mapName = process.argv[2] || "collision";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "map-generator/assets/maps", mapName, "image.png");
const infoPath = path.join(root, "map-generator/assets/maps", mapName, "info.json");
const outDir = path.join(root, "resources/maps", mapName);

const img = decodePng(fs.readFileSync(srcPath));
let w = img.w - (img.w % 4);
let h = img.h - (img.h % 4);
const terrain = Array.from({ length: w * h }, () => ({
  type: WATER,
  mag: 0,
  biome: 255,
  ocean: false,
  shore: false,
}));

for (let x = 0; x < w; x++) {
  for (let y = 0; y < h; y++) {
    const o = (y * img.w + x) * 4;
    const r = img.rgba[o];
    const g = img.rgba[o + 1];
    const b = img.rgba[o + 2];
    const a = img.rgba[o + 3];
    const t = terrain[idx(x, y, h)];
    if (a < 20 || b === 106) {
      t.type = WATER;
      t.biome = 255;
    } else if (r === 0 && g === 0 && b === 0) {
      // Keep Collision cracks flyable: treat leftover black as water, not wall.
      t.type = WATER;
      t.biome = 255;
    } else {
      const p = landPaintFromBlue(b);
      t.type = LAND;
      t.mag = p.mag;
      t.biome = p.biome;
    }
  }
}

const waterOpts = mapName === "eventhorizon" ? { allOcean: true } : {};
// Four for War: keep thin shore seals that close planet seas off from the void.
if (mapName !== "fourforwar" && mapName !== "onebigworld") {
  removeSmallIslands(terrain, w, h, minIslandSize);
}
processWater(terrain, w, h, true, waterOpts);

const mini4 = createMiniMap(terrain, w, h);
processWater(mini4.terrain, mini4.w, mini4.h, false, waterOpts);
const mini16 = createMiniMap(mini4.terrain, mini4.w, mini4.h);
processWater(mini16.terrain, mini16.w, mini16.h, false, waterOpts);

const full = packTerrain(terrain, w, h);
const m4 = packTerrain(mini4.terrain, mini4.w, mini4.h);
const m16 = packTerrain(mini16.terrain, mini16.w, mini16.h);

const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
const manifest = {
  ...info,
  map: { width: w, height: h, num_land_tiles: full.numLandTiles },
  map4x: { width: mini4.w, height: mini4.h, num_land_tiles: m4.numLandTiles },
  map16x: { width: mini16.w, height: mini16.h, num_land_tiles: m16.numLandTiles },
};

const thumb = createThumbnail(mini4.terrain, mini4.w, mini4.h, 0.5);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "map.bin"), full.packed);
fs.writeFileSync(path.join(outDir, "biome.bin"), packBiome(terrain, w, h));
fs.writeFileSync(path.join(outDir, "map4x.bin"), m4.packed);
fs.writeFileSync(path.join(outDir, "biome4x.bin"), packBiome(mini4.terrain, mini4.w, mini4.h));
fs.writeFileSync(path.join(outDir, "map16x.bin"), m16.packed);
fs.writeFileSync(
  path.join(outDir, "biome16x.bin"),
  packBiome(mini16.terrain, mini16.w, mini16.h),
);
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const pngThumb = encodePng(thumb.w, thumb.h, thumb.rgba);
fs.writeFileSync(path.join(outDir, "thumbnail.png"), pngThumb);
fs.writeFileSync(path.join(outDir, "thumbnail.webp"), pngThumb);
console.log({
  map: `${w}x${h}`,
  land: full.numLandTiles,
  land4x: m4.numLandTiles,
  land16x: m16.numLandTiles,
  thumb: `${thumb.w}x${thumb.h}`,
});
