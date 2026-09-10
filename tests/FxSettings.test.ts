import { describe, expect, test } from "vitest";
import {
  buildSpaceExplosion,
  FX_DUST,
  nukeExplosionRadius,
  SPACE_SPARK_COLORS,
  usesSinkingShipFx,
  usesSpaceExplosionFx,
} from "../src/client/render/gl/passes/fx-pass/FxSettings";
import { createRenderSettings } from "../src/client/render/gl/RenderSettings";
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
} from "../src/client/render/types";

describe("nukeExplosionRadius", () => {
  test("reads the per-bomb radius from settings", () => {
    const fx = createRenderSettings().fx;
    fx.nukeRadiusAtom = 11;
    fx.nukeRadiusHydro = 22;
    fx.nukeRadiusMirv = 33;
    expect(nukeExplosionRadius(fx, UT_ATOM_BOMB)).toBe(11);
    expect(nukeExplosionRadius(fx, UT_HYDROGEN_BOMB)).toBe(22);
    expect(nukeExplosionRadius(fx, UT_MIRV_WARHEAD)).toBe(33);
  });

  test("is undefined for non-nuke units", () => {
    expect(nukeExplosionRadius(createRenderSettings().fx, UT_WARSHIP)).toBe(
      undefined,
    );
  });
});

describe("space vs sinking death FX", () => {
  test("lake combat hulls sink", () => {
    expect(usesSinkingShipFx(UT_WARSHIP)).toBe(true);
    expect(usesSinkingShipFx(UT_MARAUDER)).toBe(true);
    expect(usesSinkingShipFx(UT_TENDER)).toBe(true);
    expect(usesSpaceExplosionFx(UT_WARSHIP)).toBe(false);
  });

  test("void hulls explode instead of sinking", () => {
    for (const type of [
      UT_VOIDSHIP,
      UT_CORSAIR,
      UT_LANCER,
      UT_VESTAL,
      UT_LANDER,
    ]) {
      expect(usesSpaceExplosionFx(type)).toBe(true);
      expect(usesSinkingShipFx(type)).toBe(false);
    }
  });

  test("burst includes red, white, yellow, orange sparks and hull debris", () => {
    const sprites = buildSpaceExplosion(42);
    const sparkTints = sprites
      .filter((s) => s.tint !== null && s.fxType !== FX_DUST)
      .map((s) => s.tint!.join(","));
    for (const color of SPACE_SPARK_COLORS) {
      expect(sparkTints).toContain(color.join(","));
    }
    expect(sprites.filter((s) => s.fxType === FX_DUST).length).toBe(10);
    expect(sprites.some((s) => s.vx !== 0 || s.vy !== 0)).toBe(true);
  });
});
