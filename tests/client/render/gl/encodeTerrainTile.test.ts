import { describe, expect, test } from "vitest";
import {
  buildTerrainRGBA,
  encodeTerrainTile,
  landPaintFromBlue,
  TerrainBiome,
} from "../../../../src/client/render/gl/utils/ColorUtils";

const LAND_PLAINS = 0x80;
const LAND_HIGHLAND = 0x80 | 12;
const LAND_ICE = 0x80 | 22;
const LAND_SHORE = 0xc0;
const WATER = 0x00;
const WATER_SHORE = 0x40;
const WATER_OCEAN = 0x20;
const WATER_OCEAN_DEEP = 0x20 | 8;

function rgb(out: Uint8Array, offset = 0): [number, number, number] {
  return [out[offset], out[offset + 1], out[offset + 2]];
}

describe("encodeTerrainTile biomes", () => {
  test("deep open ocean stays near-black so the starfield can sit behind it", () => {
    const out = new Uint8Array(4);
    encodeTerrainTile(WATER_OCEAN_DEEP, out, 0);
    expect(out[0]).toBeLessThan(20);
    expect(out[1]).toBeLessThan(20);
    expect(out[2]).toBeLessThan(20);
  });

  test("low water and inland lakes are a solid sea color, not space", () => {
    const lake = new Uint8Array(4);
    const shallowOcean = new Uint8Array(4);
    encodeTerrainTile(WATER, lake, 0);
    encodeTerrainTile(WATER_OCEAN, shallowOcean, 0);
    expect(lake[2]).toBeGreaterThan(40);
    expect(lake[2]).toBeGreaterThan(lake[0]);
    expect(shallowOcean[2]).toBeGreaterThan(40);
  });

  test("legacy plains (no biome.bin) stay terrestrial green", () => {
    const out = new Uint8Array(4);
    encodeTerrainTile(LAND_PLAINS, out, 0);
    const [r, g] = rgb(out);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(150);
  });

  test("legacy highland stays tan, not volcanic", () => {
    const out = new Uint8Array(4);
    encodeTerrainTile(LAND_HIGHLAND, out, 0);
    const [r, g, b] = rgb(out);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  test("legacy mountains stay icy", () => {
    const out = new Uint8Array(4);
    encodeTerrainTile(LAND_ICE, out, 0);
    const [r, g, b] = rgb(out);
    expect(b).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(180);
  });

  test("same magnitude can be rocky, green, ice, or lava via biome.bin", () => {
    const rocky = new Uint8Array(4);
    const terra = new Uint8Array(4);
    const ice = new Uint8Array(4);
    const lava = new Uint8Array(4);
    encodeTerrainTile(LAND_PLAINS, rocky, 0, undefined, TerrainBiome.Rocky);
    encodeTerrainTile(LAND_PLAINS, terra, 0, undefined, TerrainBiome.Terrestrial);
    encodeTerrainTile(LAND_PLAINS, ice, 0, undefined, TerrainBiome.Ice);
    encodeTerrainTile(LAND_PLAINS, lava, 0, undefined, TerrainBiome.Volcanic);
    expect(rgb(rocky)[1]).toBeLessThan(rgb(terra)[1]);
    expect(rgb(ice)[2]).toBeGreaterThan(rgb(terra)[2]);
    expect(rgb(lava)[0]).toBeGreaterThan(rgb(lava)[1]);
    expect(rgb(lava)[0]).toBeGreaterThan(rgb(terra)[0]);
  });

  test("blue channel bands map onto height plus biome, not stolen combat mag", () => {
    const rocky = landPaintFromBlue(120);
    const terra = landPaintFromBlue(150);
    const ice = landPaintFromBlue(190);
    const lava = landPaintFromBlue(230);
    expect(rocky.biome).toBe(TerrainBiome.Rocky);
    expect(terra.biome).toBe(TerrainBiome.Terrestrial);
    expect(ice.biome).toBe(TerrainBiome.Ice);
    expect(lava.biome).toBe(TerrainBiome.Volcanic);
    expect(rocky.magnitude).toBeGreaterThanOrEqual(0);
    expect(rocky.magnitude).toBeLessThanOrEqual(30);
    expect(terra.magnitude).toBeGreaterThanOrEqual(0);
    expect(terra.magnitude).toBeLessThanOrEqual(30);
  });

  test("land shoreline uses dusty sand, not beach yellow", () => {
    const out = new Uint8Array(4);
    encodeTerrainTile(LAND_SHORE, out, 0);
    expect(out[0]).toBe(138);
    expect(out[1]).toBe(132);
    expect(out[2]).toBe(124);
  });

  test("baked terrain has no star speckles on land or water", () => {
    const w = 32;
    const h = 32;
    const landPx = buildTerrainRGBA(
      new Uint8Array(w * h).fill(LAND_PLAINS),
      w,
      h,
    );
    const waterPx = buildTerrainRGBA(
      new Uint8Array(w * h).fill(WATER_OCEAN_DEEP),
      w,
      h,
    );
    const shorePx = buildTerrainRGBA(
      new Uint8Array(w * h).fill(WATER_SHORE),
      w,
      h,
    );
    for (let i = 0; i < w * h; i++) {
      const [lr, lg, lb] = rgb(landPx, i * 4);
      expect(lg).toBeGreaterThan(lr);
      expect(lb).toBeLessThan(lg);
      const [wr, wg, wb] = rgb(waterPx, i * 4);
      expect(wr).toBeLessThan(20);
      expect(wg).toBeLessThan(20);
      expect(wb).toBeLessThan(20);
      const [sr, sg, sb] = rgb(shorePx, i * 4);
      expect(sr).toBeGreaterThan(40);
      expect(sb).toBeGreaterThan(sr);
    }
  });
});
