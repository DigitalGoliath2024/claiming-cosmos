/**
 * FxSpritePass — instanced textured quads sampling an animated sprite atlas.
 *
 * Manages: sprite FX state (explosions, dust, conquest, debris).
 * Atlas layout: 12 horizontal sprite strips stacked vertically.
 * Pre-built by generate-sprite-atlases.mjs.
 */

import type { Config } from "../../../../../core/configuration/Config";
import type { ConquestFx, DeadUnitFx, RendererConfig } from "../../../types";
import {
  STRUCTURE_TYPES,
  UT_SHELL,
  UT_TRAIN,
  UT_NAVAL_MINE,
} from "../../../types";
import { DynamicInstanceBuffer } from "../../DynamicBuffer";
import type { RenderSettings } from "../../RenderSettings";
import { createProgram, shaderSrc } from "../../utils/GlUtils";
import {
  buildSpaceExplosion,
  nukeExplosionRadius,
  usesSinkingShipFx,
  usesSpaceExplosionFx,
} from "./FxSettings";

import fxAtlasMeta from "resources/atlases/fx-atlas-meta.json";
import { assetUrl } from "src/core/AssetUrls";

import spriteFragSrc from "../../shaders/fx/sprite.frag.glsl?raw";
import spriteVertSrc from "../../shaders/fx/sprite.vert.glsl?raw";

const fxAtlasUrl = assetUrl("atlases/fx-atlas.png");

// ---------------------------------------------------------------------------
// FX type indices (atlas row)
// ---------------------------------------------------------------------------

export const FX_NUKE = 0;
export const FX_SAM_EXPLOSION = 1;
export const FX_BUILDING_EXPLOSION = 2;
export const FX_UNIT_EXPLOSION = 3;
export const FX_MINI_EXPLOSION = 4;
export const FX_SINKING_SHIP = 5;
export const FX_MINI_FIRE = 6;
export const FX_MINI_SMOKE = 7;
export const FX_MINI_BIG_SMOKE = 8;
export const FX_MINI_SMOKE_FIRE = 9;
export const FX_DUST = 10;
export const FX_CONQUEST = 11;
const FX_TYPE_COUNT = 12;

// ---------------------------------------------------------------------------
// FX sprite config (matches AnimatedSpriteLoader)
// ---------------------------------------------------------------------------

interface FxTypeConfig {
  frameWidth: number;
  frameCount: number;
  frameDurationMs: number;
  looping: boolean;
}

const FX_CONFIG: FxTypeConfig[] = [
  /* 0 Nuke          */ {
    frameWidth: 60,
    frameCount: 9,
    frameDurationMs: 70,
    looping: false,
  },
  /* 1 SAMExplosion   */ {
    frameWidth: 48,
    frameCount: 9,
    frameDurationMs: 70,
    looping: false,
  },
  /* 2 BuildingExpl   */ {
    frameWidth: 17,
    frameCount: 10,
    frameDurationMs: 70,
    looping: false,
  },
  /* 3 UnitExplosion  */ {
    frameWidth: 19,
    frameCount: 4,
    frameDurationMs: 70,
    looping: false,
  },
  /* 4 MiniExplosion  */ {
    frameWidth: 13,
    frameCount: 4,
    frameDurationMs: 70,
    looping: false,
  },
  /* 5 SinkingShip    */ {
    frameWidth: 16,
    frameCount: 14,
    frameDurationMs: 90,
    looping: false,
  },
  /* 6 MiniFire       */ {
    frameWidth: 7,
    frameCount: 6,
    frameDurationMs: 100,
    looping: true,
  },
  /* 7 MiniSmoke      */ {
    frameWidth: 11,
    frameCount: 4,
    frameDurationMs: 120,
    looping: true,
  },
  /* 8 MiniBigSmoke   */ {
    frameWidth: 24,
    frameCount: 5,
    frameDurationMs: 120,
    looping: true,
  },
  /* 9 MiniSmokeFire  */ {
    frameWidth: 24,
    frameCount: 5,
    frameDurationMs: 120,
    looping: true,
  },
  /* 10 Dust          */ {
    frameWidth: 9,
    frameCount: 3,
    frameDurationMs: 100,
    looping: false,
  },
  /* 11 Conquest      */ {
    frameWidth: 21,
    frameCount: 10,
    frameDurationMs: 90,
    looping: false,
  },
];

// ---------------------------------------------------------------------------
// Nuke debris plan
// ---------------------------------------------------------------------------

const DEBRIS_PLAN = [
  { type: FX_MINI_FIRE, radiusFactor: 1.0, density: 1 / 25 },
  { type: FX_MINI_SMOKE, radiusFactor: 1.0, density: 1 / 28 },
  { type: FX_MINI_BIG_SMOKE, radiusFactor: 0.9, density: 1 / 70 },
  { type: FX_MINI_SMOKE_FIRE, radiusFactor: 0.9, density: 1 / 70 },
];

/** Deterministic float in [0,1) from an integer seed (mulberry32). */
function seededRandom(seed: number): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Active FX state
// ---------------------------------------------------------------------------

interface ActiveFx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fxType: number;
  startMs: number;
  lifetimeMs: number;
  fadeIn: number; // fraction 0–1 (start of full alpha)
  fadeOut: number; // fraction 0–1 (start of fade out)
  scale: number;
  tintR: number;
  tintG: number;
  tintB: number;
  useTint: boolean;
}

// ---------------------------------------------------------------------------
// Instance data layout
// ---------------------------------------------------------------------------

const SPRITE_FLOATS = 8; // x, y, fxType, scale, tintR, tintG, tintB, flags
const SPRITE_BYTES = 32;

// ---------------------------------------------------------------------------
// FxSpritePass
// ---------------------------------------------------------------------------

export class FxSpritePass {
  private gl: WebGL2RenderingContext;
  private mapW: number;
  private settings: RenderSettings;

  private program: WebGLProgram;
  private uCamera: WebGLUniformLocation;
  private uFxUV: WebGLUniformLocation;
  private uFxWorld: WebGLUniformLocation;
  private vao: WebGLVertexArrayObject;
  private instanceBuf: DynamicInstanceBuffer;
  private spriteCount = 0;
  private atlasTex: WebGLTexture;
  private atlasReady = false;

  private activeFx: ActiveFx[] = [];
  private timeFn: () => number = () => performance.now();

  constructor(
    gl: WebGL2RenderingContext,
    header: RendererConfig,
    settings: RenderSettings,
    private config: Config,
  ) {
    this.gl = gl;
    this.mapW = header.mapWidth;
    this.settings = settings;

    this.program = createProgram(
      gl,
      shaderSrc(spriteVertSrc, { FX_TYPE_COUNT }),
      spriteFragSrc,
    );
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uFxUV = gl.getUniformLocation(this.program, "uFxUV")!;
    this.uFxWorld = gl.getUniformLocation(this.program, "uFxWorld")!;
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "uAtlas"), 0);

    // Placeholder atlas (1x1 transparent)
    this.atlasTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Instance buffer
    const glBuf = gl.createBuffer()!;
    this.instanceBuf = new DynamicInstanceBuffer(gl, glBuf, 256, SPRITE_FLOATS);

    // VAO
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, SPRITE_BYTES, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, SPRITE_BYTES, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.UNSIGNED_BYTE, false, SPRITE_BYTES, 28);
    gl.vertexAttribDivisor(3, 1);

    gl.bindVertexArray(null);

    this.loadAtlas();
  }

  // -------------------------------------------------------------------------
  // Atlas loading
  // -------------------------------------------------------------------------

  private isDisposed = false;

  private async loadAtlas(): Promise<void> {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = fxAtlasUrl;
      await img.decode();
      if (this.isDisposed) return;
      const gl = this.gl;

      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      const meta = fxAtlasMeta;
      const uvData = new Float32Array(FX_TYPE_COUNT * 4);
      const worldData = new Float32Array(FX_TYPE_COUNT * 4);

      for (let i = 0; i < FX_TYPE_COUNT; i++) {
        const row = meta.rows[i];
        uvData[i * 4 + 0] = row.yOffset / meta.height;
        uvData[i * 4 + 1] = row.height / meta.height;
        uvData[i * 4 + 2] = row.worldWidth / meta.width;
        uvData[i * 4 + 3] = 0;
        worldData[i * 4 + 0] = row.worldWidth;
        worldData[i * 4 + 1] = row.worldHeight;
        worldData[i * 4 + 2] = 0;
        worldData[i * 4 + 3] = 0;
      }

      gl.useProgram(this.program);
      gl.uniform4fv(this.uFxUV, uvData);
      gl.uniform4fv(this.uFxWorld, worldData);

      this.atlasReady = true;
    } catch (e) {
      console.warn("Failed to load fx atlas:", e);
    }
  }

  // -------------------------------------------------------------------------
  // Spawning
  // -------------------------------------------------------------------------

  applyRailroadDust(tileRefs: number[]): void {
    const now = this.timeFn();
    for (const ref of tileRefs) {
      if (Math.random() > 0.33) continue;
      const x = ref % this.mapW;
      const y = (ref - x) / this.mapW;
      this.pushFx(x, y, FX_DUST, now);
    }
  }

  applyConquestEvents(events: ConquestFx[]): void {
    const now = this.timeFn();
    const fx = this.settings.fx;
    for (const evt of events) {
      const startMs = now - (evt.tickAge ?? 0) * this.config.msPerTick();
      if (now - startMs >= fx.conquestLifetimeMs) continue;
      this.activeFx.push({
        x: evt.x,
        y: evt.y,
        vx: 0,
        vy: 0,
        fxType: FX_CONQUEST,
        startMs,
        lifetimeMs: fx.conquestLifetimeMs,
        fadeIn: fx.conquestFadeIn,
        fadeOut: fx.conquestFadeOut,
        scale: 1,
        tintR: 1,
        tintG: 1,
        tintB: 1,
        useTint: false,
      });
    }
  }

  /**
   * Spawn sprite FX for a dead unit. Returns the nuke radius if a nuke
   * exploded (so the orchestrator can also spawn a shockwave), or null.
   */
  spawnFxForUnit(unit: DeadUnitFx, now: number): void {
    const typeName = unit.unitType;
    const x = unit.pos % this.mapW;
    const y = (unit.pos - x) / this.mapW;

    const nukeRadius = nukeExplosionRadius(this.settings.fx, typeName);
    if (nukeRadius !== undefined) {
      if (unit.reachedTarget) {
        this.spawnNukeSprites(x, y, nukeRadius, now, unit.pos);
      } else {
        this.pushFx(x, y, FX_SAM_EXPLOSION, now);
      }
      return;
    }

    if (typeName === UT_NAVAL_MINE) {
      this.pushFx(x, y, FX_UNIT_EXPLOSION, now);
      this.pushFx(x, y, FX_MINI_EXPLOSION, now);
      return;
    }

    if (usesSpaceExplosionFx(typeName)) {
      this.spawnSpaceExplosion(x, y, now, unit.pos);
      return;
    }

    if (usesSinkingShipFx(typeName)) {
      this.pushFx(x, y, FX_UNIT_EXPLOSION, now);
      this.pushFx(x, y, FX_SINKING_SHIP, now);
      return;
    }

    if (typeName === UT_SHELL && unit.reachedTarget) {
      this.pushFx(x, y, FX_MINI_EXPLOSION, now);
      return;
    }

    if (typeName === UT_TRAIN && !unit.reachedTarget) {
      this.pushFx(x, y, FX_MINI_EXPLOSION, now);
      return;
    }

    if (STRUCTURE_TYPES.has(typeName)) {
      this.pushFx(x, y, FX_BUILDING_EXPLOSION, now);
    }
  }

  private spawnNukeSprites(
    x: number,
    y: number,
    radius: number,
    now: number,
    pos: number,
  ): void {
    this.pushFx(x, y, FX_NUKE, now);

    let debrisIdx = 0;
    const densityScale = this.settings.fx.debrisDensity;
    for (const { type, radiusFactor, density } of DEBRIS_PLAN) {
      const count = Math.max(0, Math.floor(radius * density * densityScale));
      const r = radius * radiusFactor;
      for (let i = 0; i < count; i++) {
        const seed = pos * 997 + debrisIdx++;
        const angle = seededRandom(seed) * Math.PI * 2;
        const dist = seededRandom(seed + 0x10000) * (r / 2);
        const dx = Math.floor(Math.cos(angle) * dist);
        const dy = Math.floor(Math.sin(angle) * dist);
        this.pushDebris(x + dx, y + dy, type, now);
      }
    }
  }

  pushFx(x: number, y: number, fxType: number, now: number): void {
    const cfg = FX_CONFIG[fxType];
    this.activeFx.push({
      x,
      y,
      vx: 0,
      vy: 0,
      fxType,
      startMs: now,
      lifetimeMs: cfg.frameDurationMs * cfg.frameCount,
      fadeIn: 0,
      fadeOut: 1,
      scale: 1,
      tintR: 1,
      tintG: 1,
      tintB: 1,
      useTint: false,
    });
  }

  private spawnSpaceExplosion(
    x: number,
    y: number,
    now: number,
    seed: number,
  ): void {
    for (const sprite of buildSpaceExplosion(seed)) {
      this.activeFx.push({
        x,
        y,
        vx: sprite.vx,
        vy: sprite.vy,
        fxType: sprite.fxType,
        startMs: now + sprite.startDelayMs,
        lifetimeMs: sprite.lifetimeMs,
        fadeIn: 0,
        fadeOut: sprite.fadeOut,
        scale: sprite.scale,
        tintR: sprite.tint?.[0] ?? 1,
        tintG: sprite.tint?.[1] ?? 1,
        tintB: sprite.tint?.[2] ?? 1,
        useTint: sprite.tint !== null,
      });
    }
  }

  private pushDebris(x: number, y: number, fxType: number, now: number): void {
    const fx = this.settings.fx;
    this.activeFx.push({
      x,
      y,
      vx: 0,
      vy: 0,
      fxType,
      startMs: now,
      lifetimeMs: fx.debrisLifetimeMs,
      fadeIn: fx.debrisFadeIn,
      fadeOut: fx.debrisFadeOut,
      scale: 1,
      tintR: 1,
      tintG: 1,
      tintB: 1,
      useTint: false,
    });
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  tick(): void {
    if (this.activeFx.length === 0) return;
    const now = this.timeFn();

    for (let i = this.activeFx.length - 1; i >= 0; i--) {
      const fx = this.activeFx[i];
      if (now < fx.startMs) continue;
      if (now - fx.startMs >= fx.lifetimeMs) {
        this.activeFx[i] = this.activeFx[this.activeFx.length - 1];
        this.activeFx.pop();
      }
    }

    this.rebuildInstances(now);
  }

  private rebuildInstances(now: number): void {
    const count = this.activeFx.length;
    this.instanceBuf.ensureCapacity(count);
    let written = 0;

    for (let i = 0; i < count; i++) {
      const fx = this.activeFx[i];
      const elapsed = now - fx.startMs;
      if (elapsed < 0) {
        continue;
      }
      const cfg = FX_CONFIG[fx.fxType];

      let frameIdx: number;
      if (cfg.looping) {
        const cycle = cfg.frameDurationMs * cfg.frameCount;
        frameIdx = Math.floor((elapsed % cycle) / cfg.frameDurationMs);
      } else {
        frameIdx = Math.min(
          Math.floor(elapsed / cfg.frameDurationMs),
          cfg.frameCount - 1,
        );
      }

      let alpha = 255;
      if (fx.fadeIn > 0 || fx.fadeOut < 1) {
        const t = elapsed / fx.lifetimeMs;
        if (t < fx.fadeIn) {
          alpha = Math.floor((t / fx.fadeIn) * 255);
        } else if (t > fx.fadeOut) {
          alpha = Math.floor(((1 - t) / (1 - fx.fadeOut)) * 255);
        }
      }

      const life = Math.min(1, elapsed / fx.lifetimeMs);
      const travel = (elapsed / 1000) * (1 - 0.4 * life);

      const off = written * SPRITE_FLOATS;
      this.instanceBuf.float32[off + 0] = fx.x + fx.vx * travel;
      this.instanceBuf.float32[off + 1] = fx.y + fx.vy * travel;
      this.instanceBuf.float32[off + 2] = fx.fxType;
      this.instanceBuf.float32[off + 3] = fx.scale;
      this.instanceBuf.float32[off + 4] = fx.tintR;
      this.instanceBuf.float32[off + 5] = fx.tintG;
      this.instanceBuf.float32[off + 6] = fx.tintB;
      const byteOff = written * SPRITE_BYTES;
      this.instanceBuf.uint8[byteOff + 28] = frameIdx;
      this.instanceBuf.uint8[byteOff + 29] = alpha;
      this.instanceBuf.uint8[byteOff + 30] = fx.useTint ? 255 : 0;
      written++;
    }

    this.spriteCount = written;
  }

  // -------------------------------------------------------------------------
  // Draw
  // -------------------------------------------------------------------------

  draw(cameraMatrix: Float32Array): void {
    if (this.spriteCount === 0 || !this.atlasReady) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf.buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.instanceBuf.float32,
      0,
      this.spriteCount * SPRITE_FLOATS,
    );
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.spriteCount);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  setTimeFn(fn: () => number): void {
    this.timeFn = fn;
  }

  clear(): void {
    this.activeFx.length = 0;
    this.spriteCount = 0;
  }

  dispose(): void {
    this.isDisposed = true;
    const gl = this.gl;
    gl.deleteProgram(this.program);
    this.instanceBuf.dispose();
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.atlasTex);
  }
}
