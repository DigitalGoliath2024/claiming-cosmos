/**
 * Write biome.bin overlays for cosmic maps without touching map.bin magnitude.
 * Land → rocky (0), water/impassable → inherit (255).
 *
 * Do NOT remap magnitude for biome looks — that changes plains/highland combat.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COSMIC = ["sol", "mars", "luna", "milkyway", "pluto", "titan"];
const BINS = [
  ["map.bin", "biome.bin"],
  ["map4x.bin", "biome4x.bin"],
  ["map16x.bin", "biome16x.bin"],
];

function biomeFromMap(buf) {
  const out = Buffer.alloc(buf.length, 255);
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if ((b & 0x80) === 0) continue;
    if ((b & 0x1f) === 31) continue;
    out[i] = 0;
  }
  return out;
}

const mapsDir = path.join(root, "resources/maps");
for (const folder of COSMIC) {
  const dir = path.join(mapsDir, folder);
  if (!fs.existsSync(path.join(dir, "map.bin"))) {
    console.warn("skip missing", folder);
    continue;
  }
  for (const [src, dest] of BINS) {
    const p = path.join(dir, src);
    if (!fs.existsSync(p)) continue;
    fs.writeFileSync(path.join(dir, dest), biomeFromMap(fs.readFileSync(p)));
  }
  console.log(folder, "biome overlay = rocky land");
}
