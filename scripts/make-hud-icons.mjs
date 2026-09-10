/**
 * Build white-on-transparent 64×64 HUD / map icons.
 *
 * Ship icons come from the 13×13 bow-east sprites (silhouette, rotated bow-up).
 * Corsair, Voidship, and Starport prefer the artist sheets passed on the CLI.
 * Building icons come from resources/images/source/buildings/*.png
 * (dark-on-transparent 150×150 art, inverted to white).
 *
 *   node scripts/make-hud-icons.mjs --buildings-only
 *   node scripts/make-hud-icons.mjs --ocean
 *   node scripts/make-hud-icons.mjs [voidship.png] [starport.png] [corsair.png]
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 64;
const STARPORT_FIT = 0.62; // keep the glyph inside a diamond map container

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
  let bitDepth = 8;
  let colorType = 6;
  const idats = [];
  let palette = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[src++];
    const row = Buffer.alloc(stride);
    inflated.copy(row, 0, src, src + stride);
    src += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i];
      const upLeft = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + ((left + up) >> 1)) & 255;
      else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      if (colorType === 6) {
        row.copy(rgba, di, x * 4, x * 4 + 4);
      } else if (colorType === 2) {
        rgba[di] = row[x * 3];
        rgba[di + 1] = row[x * 3 + 1];
        rgba[di + 2] = row[x * 3 + 2];
        rgba[di + 3] = 255;
      } else if (colorType === 0) {
        rgba[di] = rgba[di + 1] = rgba[di + 2] = row[x];
        rgba[di + 3] = 255;
      } else if (colorType === 4) {
        rgba[di] = rgba[di + 1] = rgba[di + 2] = row[x * 2];
        rgba[di + 3] = row[x * 2 + 1];
      } else if (colorType === 3) {
        const pi = row[x] * 3;
        rgba[di] = palette[pi];
        rgba[di + 1] = palette[pi + 1];
        rgba[di + 2] = palette[pi + 2];
        rgba[di + 3] = 255;
      }
    }
    prev = row;
  }
  return { width, height, rgba };
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contentMask(width, height, rgba) {
  const mask = Buffer.alloc(width * height);
  let ink = 0;
  let paper = 0;
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3];
    const lum = luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (a > 8 && lum < 40) ink++;
    if (a > 8 && lum > 200) paper++;
  }
  const darkOnLight = ink > paper * 2 && ink > 40;
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3];
    const lum = luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    const on = darkOnLight
      ? a > 8 && lum < 80
      : a > 16 && lum > 40;
    mask[i] = on ? 255 : 0;
  }
  return mask;
}

function bboxOf(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function rotateMaskBowUp(mask, width, height) {
  // Bow-east (+x) → bow-up (image -y): (x, y) → (y, w - 1 - x)
  const out = Buffer.alloc(width * height);
  const nw = height;
  const nh = width;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = y;
      const ny = width - 1 - x;
      out[ny * nw + nx] = mask[y * width + x];
    }
  }
  return { mask: out, width: nw, height: nh };
}

function blitFit(mask, width, height, fit = 0.82) {
  const box = bboxOf(mask, width, height);
  if (!box) throw new Error("empty icon");
  const bw = box.maxX - box.minX + 1;
  const bh = box.maxY - box.minY + 1;
  const dest = Math.max(8, Math.round(SIZE * fit));
  const scale = dest / Math.max(bw, bh);
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));
  const ox = Math.floor((SIZE - dw) / 2);
  const oy = Math.floor((SIZE - dh) / 2);
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < dh; y++) {
    const sy = box.minY + Math.min(bh - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x++) {
      const sx = box.minX + Math.min(bw - 1, Math.floor(x / scale));
      if (!mask[sy * width + sx]) continue;
      const dx = ox + x;
      const dy = oy + y;
      const i = (dy * SIZE + dx) * 4;
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function iconFromSheet(file, fit) {
  const { width, height, rgba } = decodePng(fs.readFileSync(file));
  const mask = contentMask(width, height, rgba);
  const box = bboxOf(mask, width, height);
  console.log(
    path.basename(file),
    `${width}x${height}`,
    box
      ? `content ${box.maxX - box.minX + 1}x${box.maxY - box.minY + 1}`
      : "EMPTY",
  );
  return blitFit(mask, width, height, fit);
}

function iconFromSprite(file, fit = 0.84) {
  const { width, height, rgba } = decodePng(fs.readFileSync(file));
  const mask = contentMask(width, height, rgba);
  const rotated = rotateMaskBowUp(mask, width, height);
  return blitFit(rotated.mask, rotated.width, rotated.height, fit);
}

function writeIcon(name, rgba) {
  const out = path.join(root, "resources/images", name);
  fs.writeFileSync(out, encodePng(SIZE, SIZE, rgba));
  console.log("wrote", out);
}

const sheets = {
  voidship: process.argv[2],
  starport: process.argv[3],
  corsair: process.argv[4],
};

const sprites = {
  warship: path.join(root, "resources/sprites/warship.png"),
  marauder: path.join(root, "resources/sprites/marauder.png"),
  tender: path.join(root, "resources/sprites/tender.png"),
  vestal: path.join(root, "resources/sprites/vestal.png"),
  voidship: path.join(root, "resources/sprites/voidship.png"),
  corsair: path.join(root, "resources/sprites/corsair.png"),
  lancer: path.join(root, "resources/sprites/lancer.png"),
  transport: path.join(root, "resources/sprites/transportship.png"),
  lander: path.join(root, "resources/sprites/lander.png"),
};

const oceanOnly = process.argv.includes("--ocean");
const writeShips =
  !process.argv.includes("--buildings-only") && !oceanOnly;

if (oceanOnly) {
  writeIcon("WarshipIconWhite.png", iconFromSprite(sprites.warship));
  writeIcon("MarauderIconWhite.png", iconFromSprite(sprites.marauder));
  writeIcon("TenderIconWhite.png", iconFromSprite(sprites.tender));
  writeIcon("NavyIconWhite.png", iconFromSprite(sprites.warship, 0.88));
} else if (writeShips) {
writeIcon("WarshipIconWhite.png", iconFromSprite(sprites.warship));
writeIcon("MarauderIconWhite.png", iconFromSprite(sprites.marauder));
writeIcon("TenderIconWhite.png", iconFromSprite(sprites.tender));
writeIcon("VestalIconWhite.png", iconFromSprite(sprites.vestal));
writeIcon("TransportIconWhite.png", iconFromSprite(sprites.transport));
writeIcon("LanderIconWhite.png", iconFromSprite(sprites.lander));
writeIcon("NavyIconWhite.png", iconFromSprite(sprites.warship, 0.88));

if (sheets.voidship && fs.existsSync(sheets.voidship)) {
  writeIcon("VoidshipIconWhite.png", iconFromSheet(sheets.voidship, 0.84));
} else {
  writeIcon("VoidshipIconWhite.png", iconFromSprite(sprites.voidship));
}

if (sheets.corsair && fs.existsSync(sheets.corsair)) {
  writeIcon("CorsairIconWhite.png", iconFromSheet(sheets.corsair, 0.84));
} else {
  writeIcon("CorsairIconWhite.png", iconFromSprite(sprites.corsair));
}

writeIcon("LancerIconWhite.png", iconFromSprite(sprites.lancer));

if (sheets.starport && fs.existsSync(sheets.starport)) {
  writeIcon(
    "StarportIconWhite.png",
    iconFromSheet(sheets.starport, STARPORT_FIT),
  );
} else {
  console.warn("skip StarportIconWhite.png (no starport sheet)");
}
}

if (!oceanOnly) {
const buildingDir = path.join(root, "resources/images/source/buildings");
const buildings = [
  ["harbor.png", "PortIconWhite.png", 0.84],
  ["starport.png", "StarportIconWhite.png", 0.78],
  ["city.png", "CityIconWhite.png", 0.84],
  ["factory.png", "FactoryIconWhite.png", 0.84],
  ["armory.png", "ArmoryIconWhite.png", 0.84],
  ["defense-post.png", "DefensePostIconWhite.png", 0.84],
  ["inland-battery.png", "InlandBatteryIconWhite.png", 0.84],
  ["anti-ship-battery.png", "PortGunIconWhite.png", 0.84],
];
for (const [src, dest, fit] of buildings) {
  const file = path.join(buildingDir, src);
  if (!fs.existsSync(file)) {
    console.warn("skip", dest, "(missing", src + ")");
    continue;
  }
  writeIcon(dest, iconFromSheet(file, fit));
}
}
