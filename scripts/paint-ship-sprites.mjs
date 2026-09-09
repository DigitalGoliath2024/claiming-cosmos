/**
 * Ocean hulls (transport / trade / warship / marauder / tender) are unchanged.
 * Void hulls (Voidship / Corsair / Vestal) live in their own atlas columns.
 * Voidship + Corsair come from the player's pixel drawings (rotated bow-east).
 * Vestal reuses the original twin-pod support silhouette.
 *
 * Grayscale bands: 180 hull, 130 deck, 100 accent, 70 outline (player-tinted),
 * Void hulls use the same gray bands as ocean ships so the hull takes
 * player/team color, with yellow windows, gray guns, and a short engine line.
 * Sprites face east (bow on +x).
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CELL = 13;

const PALETTE = {
  ".": null,
  D: [70, 70, 70, 255],
  M: [130, 130, 130, 255],
  C: [100, 100, 100, 255],
  L: [180, 180, 180, 255],
  S: [20, 20, 20, 255],
  N: [48, 48, 48, 255],
  I: [200, 200, 200, 255],
  W: [230, 230, 230, 255],
  E: [255, 255, 255, 255],
  K: [0, 0, 0, 255],
  Y: [255, 194, 14, 255],
  O: [255, 126, 0, 255],
  R: [196, 32, 32, 255],
  G: [196, 148, 40, 255],
};

/** Transport — old longboat, no sail, one engine pixel. */
const TRANSPORT = [
  ".............",
  ".............",
  ".............",
  ".............",
  "..SDDDDDS....",
  ".DLLLSLLLDD..",
  "DSLLLLLELLLLD",
  ".DLLLSLLLDD..",
  "..SDDDDDS....",
  ".............",
  ".............",
  ".............",
  ".............",
];

/** Trade ship — old cargo hull, no sail, one engine pixel. */
const TRADE = [
  ".............",
  ".............",
  ".............",
  "...SDDDDS....",
  "..DLLLSLLDD..",
  ".DLLNMMMNLD..",
  "DSLLLLMLELLLD",
  ".DLLNMMMNLD..",
  "..DLLLSLLDD..",
  "...SDDDDS....",
  ".............",
  ".............",
  ".............",
];

/** Warship / Voidship — old line hull, no sails, thinner, 3-pixel keel engine. */
const WARSHIP = [
  ".............",
  ".....S.S.....",
  "....MCMC.....",
  "..SDMMMMDS...",
  ".SLDLDLDLS...",
  "DSLLLLCLLLS..",
  "DNMMEEECCND..",
  "DSLLLLCLLLS..",
  ".SLDLDLDLS...",
  "..SDMMMMDS...",
  "....MCMC.....",
  ".....S.S.....",
  ".............",
];

/** Marauder / Corsair — old raider, no sail, thinner, 3-pixel keel engine. */
const MARAUDER = [
  ".............",
  "......S......",
  ".....CCC.....",
  "...SMMMCS....",
  "..DLSCCCS....",
  ".DLLLCCCLLS..",
  "DNMMEEECLNS..",
  ".DLLLCCCLLS..",
  "..DLSCCCS....",
  "...SMMMCS....",
  ".....CCC.....",
  "......S......",
  ".............",
];

/** Tender — lake support hull. Ocean boats stay on this art. */
const TENDER = [
  ".............",
  ".............",
  "...S.....S...",
  "..CDC...CDC..",
  ".SDDDDDDDDS..",
  "DLLSLLSELLLD.",
  "DNCCCSECCCCND",
  "DLLSLLSELLLD.",
  ".SDDDDDDDDS..",
  "..CDC...CDC..",
  "...S.....S...",
  ".............",
  ".............",
];

/** Rotate a drawing 90° clockwise so bow-east matches ocean hulls. */
function rot90cw(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let s = "";
    for (let y = h - 1; y >= 0; y--) s += rows[y][x];
    out.push(s);
  }
  return out;
}

function centerInCell(rows) {
  const h = rows.length;
  const w = rows[0].length;
  if (h > CELL || w > CELL) throw new Error("drawing larger than 13×13");
  const ox = Math.floor((CELL - w) / 2);
  const oy = Math.floor((CELL - h) / 2);
  const cells = Array.from({ length: CELL }, () => Array(CELL).fill("."));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells[oy + y][ox + x] = rows[y][x];
  }
  return cells.map((r) => r.join(""));
}

/** Nearest-neighbor shrink so a bow-east drawing fits the 13×13 atlas cell.
 *  Sample the center of each dest pixel so left/right and bow/stern stay even. */
function fitInCell(rows) {
  const h = rows.length;
  const w = rows[0].length;
  if (h <= CELL && w <= CELL) return centerInCell(rows);
  const scale = Math.min(CELL / w, CELL / h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const out = [];
  for (let y = 0; y < nh; y++) {
    let s = "";
    const sy = Math.min(h - 1, Math.max(0, Math.round((y + 0.5) * (h / nh) - 0.5)));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.max(0, Math.round((x + 0.5) * (w / nw) - 0.5)));
      s += rows[sy][sx];
    }
    out.push(s);
  }
  return centerInCell(out);
}

function stampKeelEngines(rows, n = 3) {
  const cells = rows.map((r) => r.split(""));
  let minX = CELL,
    minY = CELL,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (cells[y][x] === ".") continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const midY0 = Math.round((minY + maxY) / 2);
  const midX = Math.round((minX + maxX) / 2);
  let midY = midY0;
  let best = -1;
  for (let y = minY; y <= maxY; y++) {
    let filled = 0;
    for (let x = minX; x <= maxX; x++) {
      if (cells[y][x] !== ".") filled++;
    }
    const dist = Math.abs(y - midY0);
    if (filled > best || (filled === best && dist < Math.abs(midY - midY0))) {
      best = filled;
      midY = y;
    }
  }
  const start = midX - Math.floor(n / 2);
  for (let i = 0; i < n; i++) {
    const x = start + i;
    if (x >= 0 && x < CELL && cells[midY][x] !== ".") cells[midY][x] = "E";
  }
  return cells.map((r) => r.join(""));
}

/** Voidship — same silhouette; hull is player color like ocean ships. */
const VOIDSHIP = stampKeelEngines(
  fitInCell(
    rot90cw([
      "...LL...",
      "..LWWL..",
      ".LYYYYL.",
      ".D.LL.D.",
      ".LLYYLL.",
      "LWLWWLWL",
      ".LMCCML.",
      ".LLLLLL.",
      "LWLWWLWL",
      ".LLYYLL.",
      ".N.LL.N.",
      "LLLWWLLL",
      ".LLLLLL.",
      ".LLWWLL.",
      ".LDLLDL.",
      "..N..N..",
    ]),
  ),
);

/** Corsair — team hull, yellow windows, 4-pixel engine aft, red weapon tips. */
const CORSAIR = centerInCell(
  rot90cw([
    ".R.LL.R.",
    ".L.LL.L.",
    ".WLYYLW.",
    "...LL...",
    "..LLLL..",
    ".LLYYLL.",
    ".LEEEEL.",
    "WLLLLLLW",
    ".R....R.",
    ".R....R.",
    ".R....R.",
  ]),
);

/** Vestal — original twin-pod support hull, plus a 3-pixel roof engine. */
const VESTAL = [
  ".............",
  "....C...C....",
  "...CSC.CSC...",
  "..DDSD.DSDD..",
  ".DLLSLLLSLLD.",
  "DLLLSCECSLLLD",
  "DMMCCEEECCCLD",
  "DLLLSCECSLLLD",
  ".DLLSLLLSLLD.",
  "..DDSD.DSDD..",
  "...CSC.CSC...",
  "....C...C....",
  ".............",
];

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

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  if (buf[0] !== 137) throw new Error("not a PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported PNG colorType=${colorType} bitDepth=${bitDepth}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
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
      else if (filter !== 0) throw new Error(`bad filter ${filter}`);
    }
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      const si = x * bpp;
      rgba[di] = cur[si];
      rgba[di + 1] = cur[si + 1];
      rgba[di + 2] = cur[si + 2];
      rgba[di + 3] = bpp === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { width, height, rgba };
}

function paintGrid(rows) {
  if (rows.length !== CELL || rows.some((r) => r.length !== CELL)) {
    throw new Error("sprite grids must be 13×13");
  }
  const rgba = Buffer.alloc(CELL * CELL * 4);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const px = PALETTE[rows[y][x]];
      if (!px) continue;
      const i = (y * CELL + x) * 4;
      rgba[i] = px[0];
      rgba[i + 1] = px[1];
      rgba[i + 2] = px[2];
      rgba[i + 3] = px[3];
    }
  }
  return rgba;
}

function cropOpaque(src, w, h) {
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[(y * w + x) * 4 + 3] < 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    src.copy(
      out,
      y * cw * 4,
      ((minY + y) * w + minX) * 4,
      ((minY + y) * w + minX + cw) * 4,
    );
  }
  return { rgba: out, width: cw, height: ch };
}

const transport = paintGrid(TRANSPORT);
const trade = paintGrid(TRADE);
const warship = paintGrid(WARSHIP);
const marauder = paintGrid(MARAUDER);
const tender = paintGrid(TENDER);
const voidship = paintGrid(VOIDSHIP);
const corsair = paintGrid(CORSAIR);
const vestal = paintGrid(VESTAL);

for (const [name, rgba] of [
  ["transportship.png", transport],
  ["tradeship.png", trade],
  ["warship.png", warship],
  ["marauder.png", marauder],
  ["tender.png", tender],
  ["voidship.png", voidship],
  ["corsair.png", corsair],
  ["vestal.png", vestal],
]) {
  const cropped = cropOpaque(rgba, CELL, CELL);
  fs.writeFileSync(
    path.join(root, "resources/sprites", name),
    encodePng(cropped.width, cropped.height, cropped.rgba),
  );
}

const ATLAS_COLS = 17;
const MARAUDER_COL = 3;
const TENDER_COL = 4;
const VOIDSHIP_COL = 5;
const CORSAIR_COL = 6;
const VESTAL_COL = 7;

function insertAtlasColumn(atlas, atCol, totalCols) {
  const oldCols = atlas.width / CELL;
  if (oldCols === totalCols) return atlas;
  if (oldCols !== totalCols - 1) {
    throw new Error(`unexpected atlas size ${atlas.width}x${atlas.height}`);
  }
  const width = CELL * totalCols;
  const rgba = Buffer.alloc(width * CELL * 4);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < atlas.width; x++) {
      const oldCol = Math.floor(x / CELL);
      const newCol = oldCol >= atCol ? oldCol + 1 : oldCol;
      const nx = newCol * CELL + (x % CELL);
      const si = (y * atlas.width + x) * 4;
      const di = (y * width + nx) * 4;
      atlas.rgba.copy(rgba, di, si, si + 4);
    }
  }
  return { width, height: CELL, rgba };
}

const atlasPath = path.join(root, "resources/atlases/unit-atlas.png");
let atlas = decodePng(fs.readFileSync(atlasPath));
const oldCols = atlas.width / CELL;
if (oldCols === 14) {
  atlas = insertAtlasColumn(atlas, VOIDSHIP_COL, 15);
  atlas = insertAtlasColumn(atlas, CORSAIR_COL, 16);
  atlas = insertAtlasColumn(atlas, VESTAL_COL, ATLAS_COLS);
} else if (oldCols !== ATLAS_COLS) {
  throw new Error(`unexpected atlas size ${atlas.width}x${atlas.height}`);
}

function stampCol(col, sprite) {
  for (let y = 0; y < CELL; y++) {
    const dest = (y * atlas.width + col * CELL) * 4;
    sprite.copy(atlas.rgba, dest, y * CELL * 4, (y + 1) * CELL * 4);
  }
}

stampCol(0, transport);
stampCol(1, trade);
stampCol(2, warship);
stampCol(MARAUDER_COL, marauder);
stampCol(TENDER_COL, tender);
stampCol(VOIDSHIP_COL, voidship);
stampCol(CORSAIR_COL, corsair);
stampCol(VESTAL_COL, vestal);

/** Top-down locomotive from the player's drawing. Atlas bow is west
 *  (black nose on the left) so heading rotation matches travel direction. */
function trainEngineGrid() {
  const cells = Array.from({ length: CELL }, () => Array(CELL).fill("."));
  const along = ["KKK", "YDY", "KKK", "LDL", ".D."];
  const startX = 4;
  const startY = 5;
  for (let i = 0; i < along.length; i++) {
    for (let w = 0; w < along[i].length; w++) {
      cells[startY + w][startX + i] = along[i][w];
    }
  }
  return cells.map((row) => row.join(""));
}

const TRAIN_ENGINE_COL = 14;
const trainEngine = paintGrid(trainEngineGrid());
stampCol(TRAIN_ENGINE_COL, trainEngine);

const engineCrop = cropOpaque(trainEngine, CELL, CELL);
fs.writeFileSync(
  path.join(root, "resources/sprites", "trainEngine.png"),
  encodePng(engineCrop.width, engineCrop.height, engineCrop.rgba),
);

fs.writeFileSync(atlasPath, encodePng(atlas.width, atlas.height, atlas.rgba));
console.log(
  "wrote ocean hulls, voidship.png, corsair.png, vestal.png, trainEngine.png, unit-atlas.png",
);
