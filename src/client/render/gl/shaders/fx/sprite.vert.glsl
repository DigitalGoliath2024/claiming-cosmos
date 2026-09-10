#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aInstPos;   // x, y, fxType, scale
layout(location = 2) in vec3 aInstTint;  // rgb 0–1
layout(location = 3) in vec3 aInstFlags; // frameIdx, alpha, useTint (uint8)

uniform mat3 uCamera;
uniform vec4 uFxUV[FX_TYPE_COUNT];    // vTop, vSpan, uFrameSpan, 0
uniform vec4 uFxWorld[FX_TYPE_COUNT]; // worldW, worldH, 0, 0

out vec2  vAtlasUV;
flat out float vAlpha;
flat out vec3  vTint;
flat out float vUseTint;

void main() {
  int type = int(aInstPos.z + 0.5);
  float frameIdx = floor(aInstFlags.x + 0.5);
  float alpha = aInstFlags.y / 255.0;
  float scale = max(aInstPos.w, 0.05);

  vec4 uv = uFxUV[type];
  vec4 world = uFxWorld[type];

  vec2 center = vec2(aInstPos.x + 0.5, aInstPos.y + 0.5);
  vec2 worldPos = center + (aPos - 0.5) * vec2(world.x, world.y) * scale;

  vec3 clip = uCamera * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);

  float u = (frameIdx + aPos.x) * uv.z;
  float v = uv.x + aPos.y * uv.y;
  vAtlasUV = vec2(u, v);
  vAlpha = alpha;
  vTint = aInstTint;
  vUseTint = aInstFlags.z;
}
