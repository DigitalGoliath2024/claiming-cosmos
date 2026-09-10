/**
 * Pure (no WebGL) helpers that turn the `settings.fx` slice into per-spawn
 * FX parameters. Kept out of the passes so they can be unit-tested.
 */

import {
  UT_ATOM_BOMB,
  UT_CORSAIR,
  UT_HYDROGEN_BOMB,
  UT_LANDER,
  UT_LANCER,
  UT_MARAUDER,
  UT_MIRV_WARHEAD,
  UT_TENDER,
  UT_VESTAL,
  UT_VOIDSHIP,
  UT_WARSHIP,
} from "../../../types";
import type { RenderSettings } from "../../RenderSettings";

/** Atlas row ids — must match FxSpritePass FX_* and fx-atlas-meta.json. */
export const FX_UNIT_EXPLOSION = 3;
export const FX_MINI_EXPLOSION = 4;
export const FX_MINI_FIRE = 6;
export const FX_DUST = 10;

export const SPACE_SPARK_COLORS: readonly (readonly [number, number, number])[] =
  [
    [1.0, 0.12, 0.06],
    [1.0, 1.0, 1.0],
    [1.0, 0.92, 0.14],
    [1.0, 0.48, 0.07],
  ];

const HULL_DEBRIS_COLORS: readonly (readonly [number, number, number])[] = [
  [0.72, 0.74, 0.8],
  [0.48, 0.5, 0.55],
  [0.82, 0.78, 0.7],
];

export interface SpaceBurstSprite {
  fxType: number;
  vx: number;
  vy: number;
  scale: number;
  lifetimeMs: number;
  fadeOut: number;
  startDelayMs: number;
  tint: readonly [number, number, number] | null;
}

/**
 * Visual explosion radius (shockwave / debris scatter — not the gameplay
 * damage radius) for a detonating unit type, or undefined for non-nukes.
 */
export function nukeExplosionRadius(
  fx: RenderSettings["fx"],
  unitType: string,
): number | undefined {
  switch (unitType) {
    case UT_ATOM_BOMB:
      return fx.nukeRadiusAtom;
    case UT_HYDROGEN_BOMB:
      return fx.nukeRadiusHydro;
    case UT_MIRV_WARHEAD:
      return fx.nukeRadiusMirv;
    default:
      return undefined;
  }
}

export function usesSinkingShipFx(unitType: string): boolean {
  return (
    unitType === UT_WARSHIP ||
    unitType === UT_MARAUDER ||
    unitType === UT_TENDER
  );
}

export function usesSpaceExplosionFx(unitType: string): boolean {
  return (
    unitType === UT_VOIDSHIP ||
    unitType === UT_CORSAIR ||
    unitType === UT_LANCER ||
    unitType === UT_VESTAL ||
    unitType === UT_LANDER
  );
}

function burstRand(seed: number): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Center flash plus outward sparks (red / white / yellow / orange) and
 * hull fragments. Positions are velocities in tiles/second from the hull.
 */
export function buildSpaceExplosion(seed: number): SpaceBurstSprite[] {
  const out: SpaceBurstSprite[] = [
    {
      fxType: FX_UNIT_EXPLOSION,
      vx: 0,
      vy: 0,
      scale: 1.45,
      lifetimeMs: 280,
      fadeOut: 0.55,
      startDelayMs: 0,
      tint: null,
    },
    {
      fxType: FX_MINI_EXPLOSION,
      vx: 0,
      vy: 0,
      scale: 1.9,
      lifetimeMs: 320,
      fadeOut: 0.5,
      startDelayMs: 30,
      tint: [1, 0.85, 0.25],
    },
  ];

  for (let i = 0; i < 22; i++) {
    const r0 = burstRand(seed + i * 17);
    const r1 = burstRand(seed + i * 17 + 1);
    const r2 = burstRand(seed + i * 17 + 2);
    const angle = r0 * Math.PI * 2;
    const speed = 10 + r1 * 22;
    const color = SPACE_SPARK_COLORS[i % SPACE_SPARK_COLORS.length];
    out.push({
      fxType: r2 > 0.35 ? FX_MINI_FIRE : FX_MINI_EXPLOSION,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      scale: 0.28 + r1 * 0.45,
      lifetimeMs: 420 + r0 * 280,
      fadeOut: 0.4,
      startDelayMs: r2 * 70,
      tint: color,
    });
  }

  for (let i = 0; i < 10; i++) {
    const r0 = burstRand(seed + 400 + i * 23);
    const r1 = burstRand(seed + 401 + i * 23);
    const angle = r0 * Math.PI * 2;
    const speed = 5 + r1 * 14;
    out.push({
      fxType: FX_DUST,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      scale: 0.55 + r1 * 0.7,
      lifetimeMs: 620 + r0 * 320,
      fadeOut: 0.45,
      startDelayMs: r0 * 40,
      tint: HULL_DEBRIS_COLORS[i % HULL_DEBRIS_COLORS.length],
    });
  }

  return out;
}
