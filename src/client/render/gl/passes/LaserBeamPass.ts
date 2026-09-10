/**
 * LaserBeamPass — red lock-on beams from Lancers to their current target.
 *
 * Visible while lastVolleyTick is within lancerLaserDuration ticks.
 */

import type { UnitState } from "../../types";
import { UT_LANCER } from "../../types";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/laser-beam/laser-beam.frag.glsl?raw";
import vertSrc from "../shaders/laser-beam/laser-beam.vert.glsl?raw";

const CORE_HALF = 0.28;
const GLOW_HALF = 1.15;
const FLOATS_PER_VERT = 3; // x, y, edge
const VERTS_PER_QUAD = 6;

export class LaserBeamPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private uCamera: WebGLUniformLocation;
  private vertices = new Float32Array(0);
  private vertexCount = 0;
  private durationTicks = 20;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc);
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;

    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, FLOATS_PER_VERT * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, FLOATS_PER_VERT * 4, 8);
    gl.bindVertexArray(null);
  }

  setDurationTicks(ticks: number): void {
    this.durationTicks = ticks;
  }

  update(
    units: ReadonlyMap<number, UnitState>,
    gameTick: number,
    mapW: number,
  ): void {
    const beams: number[] = [];
    for (const unit of units.values()) {
      if (!unit.isActive || unit.unitType !== UT_LANCER) continue;
      if (unit.lastVolleyTick <= 0) continue;
      if (gameTick - unit.lastVolleyTick >= this.durationTicks) continue;
      if (unit.targetUnitId === null) continue;
      const target = units.get(unit.targetUnitId);
      if (target === undefined || !target.isActive) continue;
      const x0 = unit.pos % mapW;
      const y0 = (unit.pos - x0) / mapW;
      const x1 = target.pos % mapW;
      const y1 = (target.pos - x1) / mapW;
      this.appendQuad(beams, x0, y0, x1, y1, GLOW_HALF, 1);
      this.appendQuad(beams, x0, y0, x1, y1, CORE_HALF, 0);
    }

    this.vertexCount = beams.length / FLOATS_PER_VERT;
    if (this.vertexCount === 0) {
      this.vertices = new Float32Array(0);
      return;
    }
    this.vertices = new Float32Array(beams);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);
  }

  draw(camera: Float32Array): void {
    if (this.vertexCount === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, camera);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.buf);
  }

  private appendQuad(
    out: number[],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    half: number,
    edge: number,
  ): void {
    let dx = x1 - x0;
    let dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    dx /= len;
    dy /= len;
    const nx = -dy * half;
    const ny = dx * half;
    const ax = x0 + nx;
    const ay = y0 + ny;
    const bx = x0 - nx;
    const by = y0 - ny;
    const cx = x1 - nx;
    const cy = y1 - ny;
    const dxv = x1 + nx;
    const dyv = y1 + ny;
    out.push(ax, ay, edge, bx, by, edge, cx, cy, edge);
    out.push(ax, ay, edge, cx, cy, edge, dxv, dyv, edge);
  }
}
