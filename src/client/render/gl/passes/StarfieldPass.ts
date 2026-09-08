/**
 * StarfieldPass — void stars that lag behind the camera so the map feels
 * like it sits in front of space, not painted onto it.
 *
 * Drawn on the map quad and clipped to open-void water (ocean tiles far
 * from land). Lakes and shallows keep a solid water color with no stars.
 * Star discs are sized in pixels, so zooming in does not turn them into
 * gray squares. Two world layers use different parallax; a sparse dust
 * layer is almost screen-locked.
 */

import type { RenderSettings } from "../RenderSettings";
import starfieldFragSrc from "../shaders/starfield/starfield.frag.glsl?raw";
import starfieldVertSrc from "../shaders/starfield/starfield.vert.glsl?raw";
import { VOID_WATER_MIN_MAG } from "../utils/ColorUtils";
import { createMapQuad, createProgram, shaderSrc } from "../utils/GlUtils";

export class StarfieldPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uCamera: WebGLUniformLocation;
  private uCameraCenter: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;
  private uFarParallax: WebGLUniformLocation;
  private uFarCell: WebGLUniformLocation;
  private uFarRadiusPx: WebGLUniformLocation;
  private uFarDensity: WebGLUniformLocation;
  private uFarBrightness: WebGLUniformLocation;
  private uNearParallax: WebGLUniformLocation;
  private uNearCell: WebGLUniformLocation;
  private uNearRadiusPx: WebGLUniformLocation;
  private uNearDensity: WebGLUniformLocation;
  private uNearBrightness: WebGLUniformLocation;
  private uDustParallax: WebGLUniformLocation;
  private uDustSpacingPx: WebGLUniformLocation;
  private uDustDensity: WebGLUniformLocation;
  private uDustBrightness: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private terrainBytesTex: WebGLTexture,
    mapW: number,
    mapH: number,
    private settings: RenderSettings,
  ) {
    this.program = createProgram(
      gl,
      shaderSrc(starfieldVertSrc, { MAP_W: mapW, MAP_H: mapH }),
      shaderSrc(starfieldFragSrc, {
        MAP_W: mapW,
        MAP_H: mapH,
        VOID_WATER_MIN_MAG,
      }),
    );
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCameraCenter = gl.getUniformLocation(this.program, "uCameraCenter")!;
    this.uZoom = gl.getUniformLocation(this.program, "uZoom")!;
    this.uFarParallax = gl.getUniformLocation(this.program, "uFarParallax")!;
    this.uFarCell = gl.getUniformLocation(this.program, "uFarCell")!;
    this.uFarRadiusPx = gl.getUniformLocation(this.program, "uFarRadiusPx")!;
    this.uFarDensity = gl.getUniformLocation(this.program, "uFarDensity")!;
    this.uFarBrightness = gl.getUniformLocation(
      this.program,
      "uFarBrightness",
    )!;
    this.uNearParallax = gl.getUniformLocation(this.program, "uNearParallax")!;
    this.uNearCell = gl.getUniformLocation(this.program, "uNearCell")!;
    this.uNearRadiusPx = gl.getUniformLocation(this.program, "uNearRadiusPx")!;
    this.uNearDensity = gl.getUniformLocation(this.program, "uNearDensity")!;
    this.uNearBrightness = gl.getUniformLocation(
      this.program,
      "uNearBrightness",
    )!;
    this.uDustParallax = gl.getUniformLocation(this.program, "uDustParallax")!;
    this.uDustSpacingPx = gl.getUniformLocation(this.program, "uDustSpacingPx")!;
    this.uDustDensity = gl.getUniformLocation(this.program, "uDustDensity")!;
    this.uDustBrightness = gl.getUniformLocation(
      this.program,
      "uDustBrightness",
    )!;

    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "uTerrainBytes"), 0);

    this.vao = createMapQuad(gl, mapW, mapH);
  }

  draw(
    cameraMatrix: Float32Array,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    const gl = this.gl;
    const s = this.settings.starfield;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform2f(this.uCameraCenter, cameraX, cameraY);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform1f(this.uFarParallax, s.farParallax);
    gl.uniform1f(this.uFarCell, s.farCell);
    gl.uniform1f(this.uFarRadiusPx, s.farRadiusPx);
    gl.uniform1f(this.uFarDensity, s.farDensity);
    gl.uniform1f(this.uFarBrightness, s.farBrightness);
    gl.uniform1f(this.uNearParallax, s.nearParallax);
    gl.uniform1f(this.uNearCell, s.nearCell);
    gl.uniform1f(this.uNearRadiusPx, s.nearRadiusPx);
    gl.uniform1f(this.uNearDensity, s.nearDensity);
    gl.uniform1f(this.uNearBrightness, s.nearBrightness);
    gl.uniform1f(this.uDustParallax, s.dustParallax);
    gl.uniform1f(this.uDustSpacingPx, s.dustSpacingPx);
    gl.uniform1f(this.uDustDensity, s.dustDensity);
    gl.uniform1f(this.uDustBrightness, s.dustBrightness);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.terrainBytesTex);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
