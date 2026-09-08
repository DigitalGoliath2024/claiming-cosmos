/**
 * GPU-ready color utilities.
 *
 * Terrain RGBA: Uint8Array(w × h × 4) — one RGBA pixel per tile, computed
 * from the terrain color rules applied to the raw terrain byte layout.
 *
 * Player palette is NOT built here — consumers provide a pre-built
 * Float32Array(PALETTE_SIZE × 2 × 4) to the GPURenderer constructor.
 */

import renderDefaults from "../render-settings.json";

/** Must cover 12-bit smallID range (0-4095). */
const PALETTE_SIZE = 4096;

export function getPaletteSize(): number {
  return PALETTE_SIZE;
}

/**
 * Max colors per trail gradient = rows per block in the trail-effect texture.
 * Longer catalog color lists are truncated. Shared so the CPU side that fills
 * the texture and the GPU side that allocates it can't drift.
 */
export const MAX_TRAIL_COLORS = 8;

/**
 * The effect-palette texture stacks one MAX_TRAIL_COLORS-row block per
 * trail-styled effectType: block 0 = transportShipTrail, block 1 = nukeTrail
 * (matching the nuke bit in trail.frag.glsl), block 2 = structures (read by
 * structure.frag.glsl), block 3 = warship and block 4 = train (both read by
 * unit.frag.glsl), block 5 = railroad (read by railroad.frag.glsl). Bump this
 * if another trail-styled effectType is added (and give its consumer shader
 * the new rowBase).
 */
export const EFFECT_PALETTE_BLOCKS = 6;

/** Block index of the structures effect within the effect-palette texture. */
export const STRUCTURES_EFFECT_BLOCK = 2;

/** Block index of the warship effect within the effect-palette texture. */
export const WARSHIP_EFFECT_BLOCK = 3;

/** Block index of the train effect within the effect-palette texture. */
export const TRAIN_EFFECT_BLOCK = 4;

/** Block index of the railroad effect within the effect-palette texture. */
export const RAILROAD_EFFECT_BLOCK = 5;

// ---------- Terrain ----------

/** Parse a "#rrggbb" (or "rrggbb") hex string into an RGB tuple, or null. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Default base (shallowest, magnitude 0) color for deep water. Derived from
 * the `terrain.oceanColor` default in render-settings.json (the single source
 * of truth); used as a fallback when no override color is supplied.
 */
const DEEP_WATER_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.oceanColor,
)!;

const LAKE_WATER_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.waterColor,
)!;

/**
 * Default map background color, from `terrain.backgroundColor` in
 * render-settings.json; used as a fallback when no override is supplied.
 */
const BACKGROUND_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.backgroundColor,
)!;

const SAND_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.sandColor,
)!;

const PLAINS_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.plainsColor,
)!;

const HIGHLAND_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.highlandColor,
)!;

const MOUNTAIN_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.mountainColor,
)!;

const ROCKY_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.rockyColor,
)!;

const VOLCANIC_BASE: readonly [number, number, number] = hexToRgb(
  renderDefaults.terrain.volcanicColor,
)!;

/**
 * Open-void water (ocean bit, not shoreline, far from land). Matches
 * starfield.frag.glsl — only these tiles get stars.
 */
export const VOID_WATER_MIN_MAG = 4;

export function isSpaceWater(tb: number): boolean {
  const isLand = (tb & 0x80) !== 0;
  const isOcean = (tb & 0x20) !== 0;
  const isShoreline = (tb & 0x40) !== 0;
  const magnitude = tb & 0x1f;
  return (
    !isLand &&
    isOcean &&
    !isShoreline &&
    magnitude >= VOID_WATER_MIN_MAG
  );
}

/** Optional biome.bin values. 255 = inherit look from magnitude (legacy maps). */
export const TerrainBiome = {
  Rocky: 0,
  Terrestrial: 1,
  Ice: 2,
  Volcanic: 3,
  Inherit: 255,
} as const;

/**
 * Blue-channel paint → gameplay height (0–30) plus visual biome.
 * Same map can mix bands. Magnitude stays the sim plains/highland/mountain.
 *
 *   110–139 rocky, 140–178 terrestrial, 179–209 ice, 210–250 volcanic
 *
 * TODO: lava water / volcanic shores. Picker thumbs are still 2-color.
 */
export function landPaintFromBlue(blue: number): {
  magnitude: number;
  biome: number;
} {
  const b = Math.max(0, Math.min(255, blue));
  if (b >= 110 && b <= 139) {
    return {
      magnitude: Math.min(30, Math.round(((b - 110) * 30) / 29)),
      biome: TerrainBiome.Rocky,
    };
  }
  if (b >= 140 && b <= 178) {
    return {
      magnitude: Math.min(30, Math.round(((b - 140) * 30) / 38)),
      biome: TerrainBiome.Terrestrial,
    };
  }
  if (b >= 179 && b <= 209) {
    return {
      magnitude: Math.min(30, Math.round(((b - 179) * 30) / 30)),
      biome: TerrainBiome.Ice,
    };
  }
  if (b >= 210) {
    const bb = Math.min(b, 250);
    return {
      magnitude: Math.min(30, Math.round(((bb - 210) * 30) / 40)),
      biome: TerrainBiome.Volcanic,
    };
  }
  return { magnitude: 0, biome: TerrainBiome.Rocky };
}

/**
 * Compute a static RGBA8 texture from raw terrain bytes.
 * The single source of truth for terrain colors.
 *
 * Terrain byte layout per tile:
 *   bit 7: isLand
 *   bit 6: isShoreline
 *   bit 5: isOcean  (water only)
 *   bits 0-4: magnitude (0-31)
 *
 * Impassable terrain is encoded as isLand=1 + magnitude=31. It renders as
 * the map background colour (matching `gl.clearColor` in Renderer.ts) so the
 * map appears non-rectangular — the impassable regions are visually
 * indistinguishable from the area outside the map.
 */
/** Encode one terrain byte → RGBA, writing into `out[offset..offset+3]`. */
export interface TerrainColorOverrides {
  backgroundColor?: readonly [number, number, number];
  oceanColor?: readonly [number, number, number];
  waterColor?: readonly [number, number, number];
  sandColor?: readonly [number, number, number];
  plainsColor?: readonly [number, number, number];
  highlandColor?: readonly [number, number, number];
  mountainColor?: readonly [number, number, number];
  rockyColor?: readonly [number, number, number];
  volcanicColor?: readonly [number, number, number];
}

export function terrainOverridesFromSettings(
  t: typeof renderDefaults.terrain,
): TerrainColorOverrides {
  return {
    backgroundColor: hexToRgb(t.backgroundColor) ?? undefined,
    oceanColor: hexToRgb(t.oceanColor) ?? undefined,
    waterColor: hexToRgb(t.waterColor) ?? undefined,
    sandColor: hexToRgb(t.sandColor) ?? undefined,
    plainsColor: hexToRgb(t.plainsColor) ?? undefined,
    highlandColor: hexToRgb(t.highlandColor) ?? undefined,
    mountainColor: hexToRgb(t.mountainColor) ?? undefined,
    rockyColor: hexToRgb(t.rockyColor) ?? undefined,
    volcanicColor: hexToRgb(t.volcanicColor) ?? undefined,
  };
}

export function encodeTerrainTile(
  tb: number,
  out: Uint8Array,
  offset: number,
  colors?: TerrainColorOverrides,
  biomeByte?: number,
): void {
  const backgroundColor = colors?.backgroundColor;
  const oceanColor = colors?.oceanColor;
  const waterColor = colors?.waterColor;
  const sandColor = colors?.sandColor;
  const plainsColor = colors?.plainsColor;
  const highlandColor = colors?.highlandColor;
  const mountainColor = colors?.mountainColor;
  const rockyColor = colors?.rockyColor;
  const volcanicColor = colors?.volcanicColor;
  const biome = biomeByte ?? TerrainBiome.Inherit;

  const isLand = (tb & 0x80) !== 0;
  const isShoreline = (tb & 0x40) !== 0;
  const magnitude = tb & 0x1f;

  let r: number, g: number, b: number;

  const terrainColors = {
    ocean: oceanColor ?? DEEP_WATER_BASE,
    water: waterColor ?? LAKE_WATER_BASE,
    shoreWater: [100, 143, 255],
    sand: sandColor ?? SAND_BASE,
    plains: plainsColor ?? PLAINS_BASE,
    highland: highlandColor ?? HIGHLAND_BASE,
    mountain: mountainColor ?? MOUNTAIN_BASE,
    rocky: rockyColor ?? ROCKY_BASE,
    volcanic: volcanicColor ?? VOLCANIC_BASE,
    peak: backgroundColor ?? BACKGROUND_BASE,
  };

  // Impassable terrain: render as the map background colour so it blends
  // with the area outside the map quad. Must match the clear colour in
  // Renderer.ts drawBaseLayer() (settings.terrain.backgroundColor).
  if (isLand && magnitude === 31) {
    [r, g, b] = terrainColors.peak;
  } else if (isLand && isShoreline) {
    [r, g, b] = terrainColors.sand;
  } else if (isLand) {
    let look = biome;
    if (look === TerrainBiome.Inherit) {
      if (magnitude < 10) look = TerrainBiome.Terrestrial;
      else if (magnitude < 20) look = TerrainBiome.Terrestrial;
      else look = TerrainBiome.Ice;
    }
    const shade = magnitude;
    if (look === TerrainBiome.Rocky) {
      const base = terrainColors.rocky;
      r = base[0];
      g = Math.max(0, base[1] - 2 * (shade % 10));
      b = base[2];
    } else if (look === TerrainBiome.Volcanic) {
      const base = terrainColors.volcanic;
      const m = shade % 10;
      r = Math.min(255, base[0] + 14 * m);
      g = Math.min(255, base[1] + 6 * m);
      b = Math.min(255, base[2] + 2 * m);
    } else if (look === TerrainBiome.Ice) {
      const base = terrainColors.mountain;
      const m = biome === TerrainBiome.Inherit ? shade - 20 : shade % 10;
      r = Math.min(255, base[0] + 2 * m);
      g = Math.min(255, base[1] + 2 * m);
      b = Math.min(255, base[2] + 2 * m);
    } else if (magnitude < 10) {
      const base = terrainColors.plains;
      r = base[0];
      g = base[1] - 2 * magnitude;
      b = base[2];
    } else {
      const base = terrainColors.highland;
      const m = magnitude - 10;
      r = Math.min(255, base[0] + 2 * m);
      g = Math.min(255, base[1] + 2 * m);
      b = Math.min(255, base[2] + 2 * m);
    }
  } else if (isSpaceWater(tb)) {
    const m = Math.min(magnitude, 10);
    const base = terrainColors.ocean;
    r = Math.max(0, base[0] - m);
    g = Math.max(0, base[1] - m);
    b = Math.max(0, base[2] - m);
  } else if (isShoreline) {
    const base = terrainColors.water;
    r = Math.round(0.72 * base[0] + 72);
    g = Math.round(0.72 * base[1] + 72);
    b = Math.round(0.72 * base[2] + 72);
  } else {
    const m = Math.min(magnitude, 6);
    const base = terrainColors.water;
    r = Math.max(18, base[0] - m);
    g = Math.max(28, base[1] - m);
    b = Math.max(40, base[2] - m);
  }

  out[offset] = r;
  out[offset + 1] = g;
  out[offset + 2] = b;
  out[offset + 3] = 255;
}

export function buildTerrainRGBA(
  terrainBytes: Uint8Array,
  w: number,
  h: number,
  colors?: TerrainColorOverrides,
  biomeBytes?: Uint8Array,
): Uint8Array {
  const pixels = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    encodeTerrainTile(
      terrainBytes[i],
      pixels,
      i * 4,
      colors,
      biomeBytes?.[i],
    );
  }
  return pixels;
}
