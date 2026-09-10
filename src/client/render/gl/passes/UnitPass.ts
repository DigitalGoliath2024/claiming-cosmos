/**
 * UnitPass — GPU-rendered mobile unit sprites.
 *
 * Renders all mobile (non-structure) units: boats, nukes, shells, SAM
 * missiles, and MIRV warheads. Sea hulls (transport, trade, warship) are
 * elongated pixel-art sprites facing east and rotated to an 8-direction
 * heading from movement. Other types stay axis-aligned. Sprites are tiny
 * grayscale PNGs colorized on the GPU using gray replacement
 * (180/130/100/70, plus 20 for black sails). MIRV Warhead uses a programmatic 3×3 white square
 * (colorized to border color); Shell is a single white pixel.
 *
 * Two instanced draw calls per frame — ground units and missiles are
 * split into separate buffers for correct layer ordering:
 *   Ground/sea (boats, trains) → rendered below structures
 *   Missiles (nukes, shells, SAM, MIRV warheads) → rendered above structures
 *
 * Atlas layout (19 columns × 13px cells):
 *   Col 0: Transport (longboat, bow-east; rendered at half unit size)
 *   Col 1: Lander (void troop boat, bow-east; half unit size)
 *   Col 2: Trade Ship (cargo hull, bow-east; rendered at ~0.4 unit size)
 *   Col 3: Warship (ship of the line, bow-east)
 *   Col 4: Marauder (raked raider, bow-east)
 *   Col 5: Tender (lake support hull, bow-east)
 *   Col 6: Voidship (plus-fighter, bow-east)
 *   Col 7: Corsair (small plus-fighter, bow-east)
 *   Col 8: Lancer (needle fighter, bow-east)
 *   Col 9: Vestal (twin-pod support hull, bow-east)
 *   Col 10: Atom Bomb (7×7)
 *   Col 11: Hydrogen Bomb (9×9)
 *   Col 12: MIRV (13×13, grayscale colorized)
 *   Col 13: SAM Missile (3×3)
 *   Col 14: Shell (1×1 white pixel)
 *   Col 15: MIRV Warhead (3×3 white square)
 *   Col 16: Train Engine (top-down cab/boiler/stack/cowcatcher, bow-east)
 *   Col 17: Train Carriage (5×5)
 *   Col 18: Train Carriage Loaded (5×5)
 *
 * Data flow:
 *   FrameSnapshot.units → filter by typeToAtlasIdx → instance VBO → GPU
 *   Shells emit 2 instances (pos + lastPos) to match live game's 2-pixel trail.
 */

import { assetUrl } from "src/core/AssetUrls";
import type { Config } from "src/core/configuration/Config";
import type { RendererConfig, UnitState } from "../../types";
import {
  SMOOTHED_NUKE_TYPES,
  TrainType,
  UT_ATOM_BOMB,
  UT_HYDROGEN_BOMB,
  UT_MIRV,
  UT_MIRV_WARHEAD,
  UT_NAVAL_MINE,
  UT_SAM_MISSILE,
  UT_SHELL,
  UT_TRADE_SHIP,
  UT_TRAIN,
  UT_TRANSPORT,
  UT_LANDER,
  UT_WARSHIP,
  UT_VOIDSHIP,
  UT_CORSAIR,
  UT_LANCER,
  UT_VESTAL,
  UT_MARAUDER,
  UT_TENDER,
} from "../../types";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import type { RenderSettings } from "../RenderSettings";
import unitFragSrc from "../shaders/unit/unit.frag.glsl?raw";
import unitVertSrc from "../shaders/unit/unit.vert.glsl?raw";
import {
  getPaletteSize,
  MAX_TRAIL_COLORS,
  TRAIN_EFFECT_BLOCK,
  WARSHIP_EFFECT_BLOCK,
} from "../utils/ColorUtils";
import { createProgram, shaderSrc } from "../utils/GlUtils";

const unitAtlasUrl = assetUrl("atlases/unit-atlas.png");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unit types in atlas column order. Index = atlas column.
 *  TrainEngine/TrainCarriage/TrainCarriageLoaded are synthetic names —
 *  they don't match header.unitTypes directly. Train resolution is
 *  handled specially in updateUnits() via trainType + loaded fields.
 */
const UNIT_ORDER = [
  UT_TRANSPORT,
  UT_LANDER,
  UT_TRADE_SHIP,
  UT_WARSHIP,
  UT_MARAUDER,
  UT_TENDER,
  UT_VOIDSHIP,
  UT_CORSAIR,
  UT_LANCER,
  UT_VESTAL,
  UT_ATOM_BOMB,
  UT_HYDROGEN_BOMB,
  UT_MIRV,
  UT_SAM_MISSILE,
  UT_SHELL,
  UT_MIRV_WARHEAD,
  "TrainEngine",
  "TrainCarriage",
  "TrainCarriageLoaded",
] as const;

const ATLAS_COLS = UNIT_ORDER.length;

/** Atlas column of the hydrogen bomb — drives the GPU glow halo. */
const HYDROGEN_BOMB_COL = UNIT_ORDER.indexOf(UT_HYDROGEN_BOMB);

/** Atlas column of the warship — gates the warship cosmetic effect. */
const WARSHIP_COL = UNIT_ORDER.indexOf(UT_WARSHIP);
const MARAUDER_COL = UNIT_ORDER.indexOf(UT_MARAUDER);
const TENDER_COL = UNIT_ORDER.indexOf(UT_TENDER);
const VOIDSHIP_COL = UNIT_ORDER.indexOf(UT_VOIDSHIP);
const CORSAIR_COL = UNIT_ORDER.indexOf(UT_CORSAIR);
const LANCER_COL = UNIT_ORDER.indexOf(UT_LANCER);
const VESTAL_COL = UNIT_ORDER.indexOf(UT_VESTAL);
const TRANSPORT_COL = UNIT_ORDER.indexOf(UT_TRANSPORT);
const LANDER_COL = UNIT_ORDER.indexOf(UT_LANDER);
const TRADE_SHIP_COL = UNIT_ORDER.indexOf(UT_TRADE_SHIP);
const SHIP_LAST_COL = VESTAL_COL;

/** First atlas column of the train sprites (engine, carriage, loaded
 *  carriage are contiguous) — gates the train cosmetic effect. */
const TRAIN_FIRST_COL = UNIT_ORDER.indexOf("TrainEngine");

// ---------------------------------------------------------------------------
// Instance data layout
// ---------------------------------------------------------------------------

/**
 * Per-instance data (16 bytes):
 *   float x, y, ownerID   — 12 bytes (3 floats)
 *   uint8 atlasIdx         —  1 byte  (atlas column 0–11)
 *   uint8 flags            —  1 byte  (0 = normal, 1 = flicker, 2 = angry, 3 = trade-friendly, 4 = retreating, 5 = flicker-untargetable, 6 = trade-self, 7 = naval mine)
 *   uint8 flickerHash      —  1 byte  (per-instance flicker phase offset)
 *   uint8 style            —  1 byte  (bit 0 = marauder; bits 1–5 = 32-way heading)
 */
const FLOATS_PER_INSTANCE = 4;
const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4;

/** Flag values — passed as uint8, received as float in shader via normalized attribute */
const FLAG_NORMAL = 0;
const FLAG_FLICKER = 1;
const FLAG_ANGRY = 2;
const FLAG_TRADE_FRIENDLY = 3;
const FLAG_RETREATING = 4;
const FLAG_FLICKER_UNTARGETABLE = 5;
const FLAG_TRADE_SELF = 6;
const FLAG_NAVAL_MINE = 7;

/** Packed into the instance style byte. Marauders use their own atlas
 *  column, render smaller, and invert hull color bands. */
const STYLE_MARAUDER = 1;

const SEA_HULL_TYPES: ReadonlySet<string> = new Set([
  UT_TRANSPORT,
  UT_LANDER,
  UT_TRADE_SHIP,
  UT_WARSHIP,
  UT_MARAUDER,
  UT_TENDER,
  UT_VOIDSHIP,
  UT_CORSAIR,
  UT_LANCER,
  UT_VESTAL,
]);

/** Render-only heading steps (east, then clockwise). Packed in style bits 1–5. */
export const HEADING_STEPS = 32;
/** Trains stay on 8-way rails. Ships use the finer 32-way bins. */
export const TRAIN_HEADING_STEPS = 8;

/** How quickly display velocity follows each tile step (0–1). Lower = the
 *  staircase average holds longer, so the nose does not track every jog. */
const VEL_SMOOTH = 0.2;
/** How quickly the drawn ship chases the sim tile (0–1). */
const POS_SMOOTH = 0.4;
/** Snap the hull if it is more than this many tiles from the sim position. */
const TELEPORT_DIST2 = 25;
/** Hold heading unless the course moved more than one 32-way bin (~11°). */
const HEADING_HYSTERESIS = 1;

export interface ShipMotion {
  vx: number;
  vy: number;
  heading: number;
  x: number;
  y: number;
}

function wrapHeading(h: number): number {
  h %= HEADING_STEPS;
  if (h < 0) h += HEADING_STEPS;
  return h;
}

/** Quantized heading from a y-down delta. 0 = east, then clockwise. */
export function headingOctant(dx: number, dy: number): number {
  const step = (Math.PI * 2) / HEADING_STEPS;
  return wrapHeading(Math.round(Math.atan2(dy, dx) / step));
}

/** 8-way heading packed into the 32-step shader bins (0, 4, 8, …). */
export function headingTrain(dx: number, dy: number): number {
  const step = (Math.PI * 2) / TRAIN_HEADING_STEPS;
  let oct = Math.round(Math.atan2(dy, dx) / step);
  oct %= TRAIN_HEADING_STEPS;
  if (oct < 0) oct += TRAIN_HEADING_STEPS;
  return oct * (HEADING_STEPS / TRAIN_HEADING_STEPS);
}

function shortestHeadingDelta(from: number, to: number): number {
  let d = (to - from) % HEADING_STEPS;
  if (d > HEADING_STEPS / 2) d -= HEADING_STEPS;
  if (d < -HEADING_STEPS / 2) d += HEADING_STEPS;
  return d;
}

/** Packed 32-way bin used by the unit vertex shader. */
export function packedHeading(heading: number): number {
  return wrapHeading(Math.round(heading));
}

/**
 * Face the smoothed course. Small stair jogs stay put; a real turn (including
 * a 180) snaps so the hull does not spin through the side.
 */
export function steerHeading(
  current: number,
  vx: number,
  vy: number,
): number {
  if (vx * vx + vy * vy <= 1e-6) return current;
  const desired = headingOctant(vx, vy);
  const delta = shortestHeadingDelta(current, desired);
  if (Math.abs(delta) <= HEADING_HYSTERESIS) return current;
  return desired;
}

/**
 * Render-side ship follow: average recent tile steps so a Bresenham staircase
 * holds a steady heading, and ease the drawn position toward the sim tile.
 * Does not change game state.
 */
export function advanceShipMotion(
  prev: ShipMotion | undefined,
  x: number,
  y: number,
  lastX: number,
  lastY: number,
  moved: boolean,
): ShipMotion {
  if (prev === undefined) {
    const dx = moved ? x - lastX : 0;
    const dy = moved ? y - lastY : 0;
    return {
      vx: dx,
      vy: dy,
      heading: moved ? headingOctant(dx, dy) : 0,
      x,
      y,
    };
  }
  const lagX = x - prev.x;
  const lagY = y - prev.y;
  if (lagX * lagX + lagY * lagY > TELEPORT_DIST2) {
    prev.vx = 0;
    prev.vy = 0;
    prev.x = x;
    prev.y = y;
    return prev;
  }
  if (moved) {
    const dx = x - lastX;
    const dy = y - lastY;
    const incoming = dx * prev.vx + dy * prev.vy;
    // A reverse makes the EMA pass through (0,0), where atan2 flails and the
    // hull appears to pirouette. Snap course onto the new step instead.
    if (incoming < 0) {
      prev.vx = dx;
      prev.vy = dy;
    } else {
      prev.vx += (dx - prev.vx) * VEL_SMOOTH;
      prev.vy += (dy - prev.vy) * VEL_SMOOTH;
    }
    prev.heading = steerHeading(prev.heading, prev.vx, prev.vy);
  }
  prev.x += (x - prev.x) * POS_SMOOTH;
  prev.y += (y - prev.y) * POS_SMOOTH;
  return prev;
}

/** Slide the locomotive along heading so its rear meets the first car.
 *  Quad is 13 tiles (1 atlas pixel = 1 tile), centered on the unit.
 *  Engine is 5px (cols 4–8) so it sticks 2 tiles behind center; cars are
 *  3px so they stick 1 tile toward the engine; the lead car sits 1 tile
 *  behind the engine. Slide 3 so the coupler sits one pixel ahead of the
 *  first car. */
const TRAIN_ENGINE_FORWARD = 3;

function packGroundStyle(isMarauder: boolean, heading: number): number {
  return (isMarauder ? STYLE_MARAUDER : 0) | ((packedHeading(heading) & 31) << 1);
}

/** Atlas column indices for train sub-types (resolved from trainType + loaded) */
const TRAIN_ENGINE_COL = UNIT_ORDER.indexOf("TrainEngine");
const TRAIN_CARRIAGE_COL = UNIT_ORDER.indexOf("TrainCarriage");
const TRAIN_CARRIAGE_LOADED_COL = UNIT_ORDER.indexOf("TrainCarriageLoaded");

/** Nuke + warhead types — rendered with flickering hot colors */
const FLICKER_TYPES: ReadonlySet<string> = new Set([
  UT_ATOM_BOMB,
  UT_HYDROGEN_BOMB,
  UT_MIRV,
  UT_MIRV_WARHEAD,
  UT_SAM_MISSILE,
  UT_SHELL,
]);

/** Missile/projectile types — rendered on top of structures in the layer order.
 *  Ground/sea units (boats, trains) render below structures. */
const MISSILE_TYPES: ReadonlySet<string> = new Set([
  UT_ATOM_BOMB,
  UT_HYDROGEN_BOMB,
  UT_MIRV,
  UT_SAM_MISSILE,
  UT_SHELL,
  UT_MIRV_WARHEAD,
]);

/** Values per smoothing segment in the flat `smoothSegs` array:
 *  (instanceIdx, lastX, lastY, x, y). The push site and the read loop must
 *  agree on this width — it's the record size, not a tunable. */
const SMOOTH_SEG_STRIDE = 5;

/** Per-instance flicker phase offset, hashed from the tick position. Computed
 *  CPU-side (not from the shader's instance position) so per-frame position
 *  smoothing doesn't re-roll the flicker every frame. Matches the formula the
 *  vertex shader previously applied to its rendered position. */
export function flickerHashByte(x: number, y: number): number {
  const f = x * 0.1731 + y * 0.3179;
  return ((f - Math.floor(f)) * 255) | 0;
}

/** Stable 0–255 hash from a unit id so engine palettes don't change as ships move. */
export function unitHashByte(id: number): number {
  return (Math.imul(id | 0, 2654435761) >>> 24) & 255;
}

// ---------------------------------------------------------------------------
// Helper: create a VAO for instanced unit rendering
// ---------------------------------------------------------------------------

function createUnitVao(
  gl: WebGL2RenderingContext,
  quadBuf: WebGLBuffer,
  instanceBuf: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  // Attribute 0: unit quad [0,0]->[1,1]
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Attribute 1: per-instance vec3 (x, y, ownerID) — 3 floats at offset 0
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, BYTES_PER_INSTANCE, 0);
  gl.vertexAttribDivisor(1, 1);

  // Attribute 2: per-instance (atlasIdx, flags, flickerHash, style) — 4 uint8s at offset 12
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, BYTES_PER_INSTANCE, 12);
  gl.vertexAttribDivisor(2, 1);

  gl.bindVertexArray(null);
  return vao;
}

// ---------------------------------------------------------------------------
// UnitPass
// ---------------------------------------------------------------------------

export class UnitPass {
  private gl: WebGL2RenderingContext;
  private settings: RenderSettings;
  private program: WebGLProgram;

  private uCamera: WebGLUniformLocation;
  private uTick: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uUnitSize: WebGLUniformLocation;
  private uShipScale: WebGLUniformLocation;
  private uFlickerSpeed: WebGLUniformLocation;
  private uAngryColor: WebGLUniformLocation;
  private uAltView: WebGLUniformLocation;
  private uSelfColor: WebGLUniformLocation;
  private uAllyColor: WebGLUniformLocation;
  private uHBombGlowScale: WebGLUniformLocation;
  private uHBombGlowColor: WebGLUniformLocation;
  private uHBombGlowStrength: WebGLUniformLocation;
  private uHBombGlowInner: WebGLUniformLocation;
  private uUntargetableAlpha: WebGLUniformLocation;

  private affiliationTex: WebGLTexture | null = null;
  private altView = false;

  // Ground/sea units (boats, trains) — render below structures
  private groundVao: WebGLVertexArrayObject;
  private groundBuf: DynamicInstanceBuffer;
  private groundCount = 0;

  // Missiles/projectiles (nukes, shells, SAM) — render above structures
  private missileVao: WebGLVertexArrayObject;
  private missileBuf: DynamicInstanceBuffer;
  private missileCount = 0;

  // Per-frame nuke smoothing: flat SMOOTH_SEG_STRIDE-wide tuples
  // (instanceIdx, lastX, lastY, x, y) recorded each tick, lerped into the
  // missile buffer in drawMissiles.
  private smoothSegs: number[] = [];
  /** Same layout as smoothSegs, for sea hulls in the ground buffer. */
  private groundSmoothSegs: number[] = [];
  private lastUnitsUpdateMs = 0;
  /** Simulation tick duration in ms (Config.msPerTick). */
  private tickIntervalMs: number;

  private quadBuf: WebGLBuffer;
  private paletteTex: WebGLTexture;
  private effectTex: WebGLTexture;
  private atlasTex: WebGLTexture;

  /** Render frame counter received from renderer — drives uTick shader uniform and flicker effects */
  private frameTick = 0;
  /** Last game engine tick received for smoothing calculation resets */
  private lastGameTick = -1;
  /** Wall-clock start, for uTime (seconds) — matches StructurePass so the
   *  warship/train effects animate at the same pace as the structures effect. */
  private startTime = performance.now();

  /** unitType string → atlas column (0-11) */
  private typeToAtlasCol = new Map<string, number>();
  private mapW: number;
  /** Render-only follow state so staircase paths do not spin the hull. */
  private shipMotion = new Map<number, ShipMotion>();

  // Trade-friendly detection: enemy trade ships heading to a self/allied port
  private localPlayerID = 0;
  private friendlyOwners = new Set<number>();
  private structures: Map<number, UnitState> = new Map();

  constructor(
    gl: WebGL2RenderingContext,
    header: RendererConfig,
    paletteTex: WebGLTexture,
    effectTex: WebGLTexture,
    settings: RenderSettings,
    config: Config,
  ) {
    this.gl = gl;
    this.settings = settings;
    this.mapW = header.mapWidth;
    this.paletteTex = paletteTex;
    this.effectTex = effectTex;
    this.tickIntervalMs = config.msPerTick();

    // Build unitType string → atlas column mapping
    for (let i = 0; i < header.unitTypes.length; i++) {
      const col = UNIT_ORDER.indexOf(
        header.unitTypes[i] as (typeof UNIT_ORDER)[number],
      );
      if (col >= 0) {
        this.typeToAtlasCol.set(header.unitTypes[i], col);
      }
    }
    this.typeToAtlasCol.set(UT_MARAUDER, MARAUDER_COL);
    this.typeToAtlasCol.set(UT_CORSAIR, CORSAIR_COL);
    this.typeToAtlasCol.set(UT_LANCER, LANCER_COL);
    this.typeToAtlasCol.set(UT_TENDER, TENDER_COL);
    this.typeToAtlasCol.set(UT_VESTAL, VESTAL_COL);
    this.typeToAtlasCol.set(UT_VOIDSHIP, VOIDSHIP_COL);
    this.typeToAtlasCol.set(UT_LANDER, LANDER_COL);

    // Compile shaders
    this.program = createProgram(
      gl,
      shaderSrc(unitVertSrc, {
        ATLAS_COLS,
        HYDROGEN_BOMB_COL,
        TRANSPORT_COL,
        LANDER_COL,
        TRADE_SHIP_COL,
        TENDER_COL,
        VOIDSHIP_COL,
        CORSAIR_COL,
        LANCER_COL,
        SHIP_LAST_COL,
        TRAIN_FIRST_COL,
        HEADING_STEPS,
      }),
      shaderSrc(unitFragSrc, {
        PALETTE_SIZE: getPaletteSize(),
        ATLAS_COLS,
        WARSHIP_COL,
        MARAUDER_COL,
        TENDER_COL,
        VOIDSHIP_COL,
        CORSAIR_COL,
        LANCER_COL,
        VESTAL_COL,
        SHIP_LAST_COL,
        WARSHIP_EFFECT_ROW_BASE: WARSHIP_EFFECT_BLOCK * MAX_TRAIL_COLORS,
        TRAIN_FIRST_COL,
        TRAIN_EFFECT_ROW_BASE: TRAIN_EFFECT_BLOCK * MAX_TRAIL_COLORS,
      }),
    );
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uTick = gl.getUniformLocation(this.program, "uTick")!;
    this.uTime = gl.getUniformLocation(this.program, "uTime")!;
    this.uUnitSize = gl.getUniformLocation(this.program, "uUnitSize")!;
    this.uShipScale = gl.getUniformLocation(this.program, "uShipScale")!;
    this.uFlickerSpeed = gl.getUniformLocation(this.program, "uFlickerSpeed")!;
    this.uAngryColor = gl.getUniformLocation(this.program, "uAngryColor")!;

    this.uAltView = gl.getUniformLocation(this.program, "uAltView")!;
    this.uSelfColor = gl.getUniformLocation(this.program, "uSelfColor")!;
    this.uAllyColor = gl.getUniformLocation(this.program, "uAllyColor")!;
    this.uHBombGlowScale = gl.getUniformLocation(
      this.program,
      "uHBombGlowScale",
    )!;
    this.uHBombGlowColor = gl.getUniformLocation(
      this.program,
      "uHBombGlowColor",
    )!;
    this.uHBombGlowStrength = gl.getUniformLocation(
      this.program,
      "uHBombGlowStrength",
    )!;
    this.uHBombGlowInner = gl.getUniformLocation(
      this.program,
      "uHBombGlowInner",
    )!;
    this.uUntargetableAlpha = gl.getUniformLocation(
      this.program,
      "uUntargetableAlpha",
    )!;

    // Texture unit bindings
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "uPalette"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "uAtlas"), 1);
    gl.uniform1i(gl.getUniformLocation(this.program, "uAffiliation"), 2);
    gl.uniform1i(gl.getUniformLocation(this.program, "uEffect"), 3);

    // Create placeholder atlas texture (1x1 gray pixel)
    this.atlasTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
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
      new Uint8Array([128, 128, 128, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Start async atlas build
    this.loadAtlas();

    // --- Shared quad buffer ---
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );

    // --- Ground instance buffer + VAO ---
    const groundGlBuf = gl.createBuffer()!;
    this.groundBuf = new DynamicInstanceBuffer(
      gl,
      groundGlBuf,
      1024,
      FLOATS_PER_INSTANCE,
    );
    this.groundVao = createUnitVao(gl, this.quadBuf, groundGlBuf);

    // --- Missile instance buffer + VAO ---
    const missileGlBuf = gl.createBuffer()!;
    this.missileBuf = new DynamicInstanceBuffer(
      gl,
      missileGlBuf,
      512,
      FLOATS_PER_INSTANCE,
    );
    this.missileVao = createUnitVao(gl, this.quadBuf, missileGlBuf);
  }

  private async loadAtlas(): Promise<void> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = unitAtlasUrl;
    await img.decode();
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private emitGround(
    x: number,
    y: number,
    ownerID: number,
    atlasIdx: number,
    flags: number,
    style = 0,
    hashByte = 0,
  ): void {
    this.groundBuf.ensureCapacity(this.groundCount + 1);
    const off = this.groundCount * FLOATS_PER_INSTANCE;
    this.groundBuf.float32[off + 0] = x;
    this.groundBuf.float32[off + 1] = y;
    this.groundBuf.float32[off + 2] = ownerID;
    const byteOff = this.groundCount * BYTES_PER_INSTANCE;
    this.groundBuf.uint8[byteOff + 12] = atlasIdx;
    this.groundBuf.uint8[byteOff + 13] = flags;
    this.groundBuf.uint8[byteOff + 14] = hashByte;
    this.groundBuf.uint8[byteOff + 15] = style;
    this.groundCount++;
  }

  private emitMissile(
    x: number,
    y: number,
    ownerID: number,
    atlasIdx: number,
    flags: number,
  ): void {
    this.missileBuf.ensureCapacity(this.missileCount + 1);
    const off = this.missileCount * FLOATS_PER_INSTANCE;
    this.missileBuf.float32[off + 0] = x;
    this.missileBuf.float32[off + 1] = y;
    this.missileBuf.float32[off + 2] = ownerID;
    const byteOff = this.missileCount * BYTES_PER_INSTANCE;
    this.missileBuf.uint8[byteOff + 12] = atlasIdx;
    this.missileBuf.uint8[byteOff + 13] = flags;
    this.missileBuf.uint8[byteOff + 14] = flickerHashByte(x, y);
    this.missileCount++;
  }

  setFrameTick(frameTick: number): void {
    this.frameTick = frameTick;
  }

  updateUnits(units: Map<number, UnitState>, gameTick: number): void {
    if (gameTick !== this.lastGameTick) {
      this.lastGameTick = gameTick;
      this.lastUnitsUpdateMs = performance.now();
    }
    this.groundCount = 0;
    this.missileCount = 0;
    this.smoothSegs.length = 0;
    this.groundSmoothSegs.length = 0;

    for (const unit of units.values()) {
      if (!unit.isActive || unit.waitTicks > 0) continue;

      let atlasIdx = this.typeToAtlasCol.get(unit.unitType);

      // Train sub-type resolution: "Train" isn't in UNIT_ORDER.
      // Resolve to engine/carriage/loaded carriage based on trainType + loaded fields.
      if (atlasIdx === undefined && unit.unitType === UT_NAVAL_MINE) {
        atlasIdx = UNIT_ORDER.indexOf(UT_SHELL);
      }

      if (atlasIdx === undefined && unit.unitType === UT_TRAIN) {
        const tt = unit.trainType;
        if (tt === TrainType.Engine) {
          atlasIdx = TRAIN_ENGINE_COL;
        } else {
          atlasIdx = unit.loaded
            ? TRAIN_CARRIAGE_LOADED_COL
            : TRAIN_CARRIAGE_COL;
        }
      }

      if (atlasIdx === undefined) continue;

      const isCombatHull =
        unit.unitType === UT_WARSHIP ||
        unit.unitType === UT_VOIDSHIP ||
        unit.unitType === UT_MARAUDER ||
        unit.unitType === UT_CORSAIR ||
        unit.unitType === UT_LANCER;
      const isPatrolHull =
        isCombatHull ||
        unit.unitType === UT_TENDER ||
        unit.unitType === UT_VESTAL;
      const isRetreatingWarship = isPatrolHull && unit.retreating;
      const isAngryWarship = isCombatHull && unit.targetUnitId !== null;
      const isFlicker = FLICKER_TYPES.has(unit.unitType);

      // Alt-view trade ship color from owner + destination port owner:
      //   self involved on either end        -> green  (FLAG_TRADE_SELF)
      //   ally/teammate involved on either end -> yellow (FLAG_TRADE_FRIENDLY)
      //   otherwise                          -> red    (owner affiliation)
      let tradeFlag = FLAG_NORMAL;
      if (
        unit.unitType === UT_TRADE_SHIP &&
        unit.targetUnitId !== null &&
        this.localPlayerID > 0
      ) {
        const targetPort = this.structures.get(unit.targetUnitId);
        if (targetPort) {
          const portOwner = targetPort.ownerID;
          if (
            unit.ownerID === this.localPlayerID ||
            portOwner === this.localPlayerID
          ) {
            tradeFlag = FLAG_TRADE_SELF;
          } else if (
            this.friendlyOwners.has(unit.ownerID) ||
            this.friendlyOwners.has(portOwner)
          ) {
            tradeFlag = FLAG_TRADE_FRIENDLY;
          }
        }
      }

      let flags = FLAG_NORMAL;
      if (tradeFlag !== FLAG_NORMAL) {
        flags = tradeFlag;
      } else if (isRetreatingWarship) {
        flags = FLAG_RETREATING;
      } else if (isAngryWarship) {
        flags = FLAG_ANGRY;
      } else if (isFlicker) {
        // Untargetable nukes render dimmed so players can tell SAMs can't hit them
        flags = unit.targetable ? FLAG_FLICKER : FLAG_FLICKER_UNTARGETABLE;
      }
      if (unit.unitType === UT_NAVAL_MINE) {
        flags = FLAG_NAVAL_MINE;
      }
      const isMissile = MISSILE_TYPES.has(unit.unitType);

      const x = unit.pos % this.mapW;
      const y = (unit.pos - x) / this.mapW;

      if (isMissile) {
        if (
          SMOOTHED_NUKE_TYPES.has(unit.unitType) &&
          unit.lastPos !== unit.pos
        ) {
          const lx = unit.lastPos % this.mapW;
          const ly = (unit.lastPos - lx) / this.mapW;
          this.smoothSegs.push(this.missileCount, lx, ly, x, y);
        }
        this.emitMissile(x, y, unit.ownerID, atlasIdx, flags);

        // Shells emit a second instance at lastPos (2-pixel trail effect)
        if (unit.unitType === UT_SHELL && unit.lastPos !== unit.pos) {
          const lx = unit.lastPos % this.mapW;
          const ly = (unit.lastPos - lx) / this.mapW;
          this.emitMissile(lx, ly, unit.ownerID, atlasIdx, flags);
        }
      } else {
        let drawX = x;
        let drawY = y;
        let heading = 0;
        if (SEA_HULL_TYPES.has(unit.unitType) || unit.unitType === UT_TRAIN) {
          const moved = unit.lastPos !== unit.pos;
          const lastX = moved ? unit.lastPos % this.mapW : x;
          const lastY = moved ? (unit.lastPos - lastX) / this.mapW : y;
          const from = this.shipMotion.get(unit.id);
          const fromX = from?.x ?? x;
          const fromY = from?.y ?? y;
          const motion = advanceShipMotion(
            from,
            x,
            y,
            lastX,
            lastY,
            moved,
          );
          if (unit.unitType === UT_TRAIN) {
            if (moved) {
              motion.heading = headingTrain(x - lastX, y - lastY);
            }
          } else if (
            !moved &&
            unit.targetTile !== null &&
            unit.targetTile !== unit.pos
          ) {
            const tx = unit.targetTile % this.mapW;
            const ty = (unit.targetTile - tx) / this.mapW;
            motion.vx += (tx - x - motion.vx) * 0.05;
            motion.vy += (ty - y - motion.vy) * 0.05;
            motion.heading = steerHeading(motion.heading, motion.vx, motion.vy);
          }
          this.shipMotion.set(unit.id, motion);
          heading = motion.heading;
          drawX = motion.x;
          drawY = motion.y;
          let segFromX = fromX;
          let segFromY = fromY;
          if (
            unit.unitType === UT_TRAIN &&
            unit.trainType === TrainType.Engine
          ) {
            const ang = (heading * Math.PI * 2) / HEADING_STEPS;
            const ox = Math.cos(ang) * TRAIN_ENGINE_FORWARD;
            const oy = Math.sin(ang) * TRAIN_ENGINE_FORWARD;
            drawX += ox;
            drawY += oy;
            segFromX += ox;
            segFromY += oy;
          }
          if (segFromX !== drawX || segFromY !== drawY) {
            this.groundSmoothSegs.push(
              this.groundCount,
              segFromX,
              segFromY,
              drawX,
              drawY,
            );
          }
        }
        this.emitGround(
          drawX,
          drawY,
          unit.ownerID,
          atlasIdx,
          flags,
          packGroundStyle(unit.unitType === UT_MARAUDER, heading),
          unitHashByte(unit.id),
        );
      }
    }

    const gl = this.gl;
    if (this.groundCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.groundBuf.buffer);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.groundBuf.float32,
        0,
        this.groundCount * FLOATS_PER_INSTANCE,
      );
    }
    if (this.missileCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.missileBuf.buffer);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.missileBuf.float32,
        0,
        this.missileCount * FLOATS_PER_INSTANCE,
      );
    }
  }

  setAltView(active: boolean): void {
    this.altView = active;
  }
  setAffiliationTex(tex: WebGLTexture): void {
    this.affiliationTex = tex;
  }
  setLocalPlayer(id: number): void {
    this.localPlayerID = id;
  }
  setAllies(allies: Set<number>): void {
    this.friendlyOwners = allies;
  }
  setStructures(structs: Map<number, UnitState>): void {
    this.structures = structs;
  }

  /** Bind shared program state + uniforms (call before drawGround/drawMissiles). */
  private bindProgram(cameraMatrix: Float32Array): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    const us = this.settings.unit;
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uTick, this.frameTick);
    gl.uniform1f(this.uTime, (performance.now() - this.startTime) / 1000);
    gl.uniform1f(this.uUnitSize, us.unitSize);
    gl.uniform1f(this.uShipScale, us.shipScale);
    gl.uniform1f(this.uFlickerSpeed, us.flickerSpeed);
    gl.uniform3f(this.uAngryColor, us.angryR, us.angryG, us.angryB);
    gl.uniform1i(this.uAltView, this.altView ? 1 : 0);
    const af = this.settings.affiliation;
    gl.uniform3f(this.uSelfColor, af.selfR, af.selfG, af.selfB);
    gl.uniform3f(this.uAllyColor, af.allyR, af.allyG, af.allyB);
    gl.uniform1f(this.uHBombGlowScale, us.hBombGlowScale);
    gl.uniform3f(
      this.uHBombGlowColor,
      us.hBombGlowR,
      us.hBombGlowG,
      us.hBombGlowB,
    );
    gl.uniform1f(this.uHBombGlowStrength, us.hBombGlowStrength);
    gl.uniform1f(this.uHBombGlowInner, us.hBombGlowInner);
    gl.uniform1f(this.uUntargetableAlpha, us.untargetableAlpha);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);

    if (this.affiliationTex) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.affiliationTex);
    }

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.effectTex);
  }

  /** Draw ground/sea units (boats, trains). Render below structures. */
  drawGround(cameraMatrix: Float32Array): void {
    if (this.groundCount === 0) return;
    this.applyGroundSmoothing();
    this.bindProgram(cameraMatrix);
    const gl = this.gl;
    gl.bindVertexArray(this.groundVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.groundCount);
  }

  /** Draw missiles/projectiles (nukes, shells, SAM, MIRV warheads). Render above structures. */
  drawMissiles(cameraMatrix: Float32Array): void {
    if (this.missileCount === 0) return;
    this.applyMissileSmoothing();
    this.bindProgram(cameraMatrix);
    const gl = this.gl;
    gl.bindVertexArray(this.missileVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.missileCount);
  }

  /** Lerp smoothed nukes lastPos→pos by wall-clock progress through the
   *  current tick and re-upload the (small) missile instance buffer. */
  private applyMissileSmoothing(): void {
    this.applySmoothSegs(
      this.smoothSegs,
      this.missileBuf.float32,
      this.missileBuf.buffer,
      this.missileCount,
    );
  }

  /** Lerp sea-hull display positions between ticks (render-only). */
  private applyGroundSmoothing(): void {
    this.applySmoothSegs(
      this.groundSmoothSegs,
      this.groundBuf.float32,
      this.groundBuf.buffer,
      this.groundCount,
    );
  }

  private applySmoothSegs(
    segs: number[],
    f32: Float32Array,
    buffer: WebGLBuffer,
    instanceCount: number,
  ): void {
    if (segs.length === 0) return;
    const alpha = Math.min(
      1,
      (performance.now() - this.lastUnitsUpdateMs) / this.tickIntervalMs,
    );
    for (let i = 0; i < segs.length; i += SMOOTH_SEG_STRIDE) {
      const off = segs[i] * FLOATS_PER_INSTANCE;
      f32[off + 0] = segs[i + 1] + (segs[i + 3] - segs[i + 1]) * alpha;
      f32[off + 1] = segs[i + 2] + (segs[i + 4] - segs[i + 2]) * alpha;
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      f32,
      0,
      instanceCount * FLOATS_PER_INSTANCE,
    );
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    this.groundBuf.dispose();
    this.missileBuf.dispose();
    gl.deleteBuffer(this.quadBuf);
    gl.deleteVertexArray(this.groundVao);
    gl.deleteVertexArray(this.missileVao);
    gl.deleteTexture(this.atlasTex);
  }
}
