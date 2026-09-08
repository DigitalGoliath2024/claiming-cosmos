#version 300 es
precision highp float;
precision highp usampler2D;

uniform usampler2D uTerrainBytes;
uniform vec2 uCameraCenter;
uniform float uZoom;
uniform float uFarParallax;
uniform float uFarCell;
uniform float uFarRadiusPx;
uniform float uFarDensity;
uniform float uFarBrightness;
uniform float uNearParallax;
uniform float uNearCell;
uniform float uNearRadiusPx;
uniform float uNearDensity;
uniform float uNearBrightness;
uniform float uDustParallax;
uniform float uDustSpacingPx;
uniform float uDustDensity;
uniform float uDustBrightness;

in vec2 vUV;
in vec2 vWorld;
out vec4 fragColor;

uint hash(ivec2 p) {
  uint x = uint(p.x) * 1597334677u ^ uint(p.y) * 3812015801u;
  x ^= x >> 16;
  x *= 2246822519u;
  x ^= x >> 13;
  x *= 3266489917u;
  x ^= x >> 16;
  return x;
}

float hash01(ivec2 p) {
  return float(hash(p)) * (1.0 / 4294967295.0);
}

vec2 cellJitter(ivec2 id) {
  return vec2(hash01(id), hash01(id + ivec2(17, 9))) - 0.5;
}

void addLayer(
  inout vec3 col,
  vec2 starWorld,
  float cell,
  float radiusPx,
  float density,
  float brightness,
  ivec2 salt
) {
  vec2 scaled = starWorld / cell;
  ivec2 base = ivec2(floor(scaled));
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      ivec2 id = base + ivec2(ox, oy);
      float gate = hash01(id + salt);
      if (gate > density) continue;
      vec2 center = (vec2(id) + 0.5 + cellJitter(id + salt) * 0.85) * cell;
      float distPx = length(starWorld - center) * uZoom;
      float radius = radiusPx * mix(0.65, 1.4, hash01(id + salt + ivec2(3, 1)));
      float a = 1.0 - smoothstep(0.0, radius, distPx);
      a *= a;
      float b = brightness * mix(0.4, 1.0, 1.0 - gate / max(density, 0.0001));
      col += vec3(b, b, min(1.0, b * 1.08)) * a;
    }
  }
}

void main() {
  ivec2 tc = ivec2(
    int(vUV.x * float(MAP_W)),
    int(vUV.y * float(MAP_H))
  );
  tc = clamp(tc, ivec2(0), ivec2(MAP_W - 1, MAP_H - 1));
  uint terrainByte = texelFetch(uTerrainBytes, tc, 0).r;
  // Stars only on open void: water + ocean + not shoreline + far from land.
  // Must match isSpaceWater() in ColorUtils.ts.
  if ((terrainByte & 0x80u) != 0u) discard;
  if ((terrainByte & 0x20u) == 0u) discard;
  if ((terrainByte & 0x40u) != 0u) discard;
  if ((terrainByte & 0x1fu) < uint(VOID_WATER_MIN_MAG)) discard;

  vec3 col = vec3(0.0);

  vec2 dust = gl_FragCoord.xy + uCameraCenter * uDustParallax;
  ivec2 dustId = ivec2(floor(dust / max(uDustSpacingPx, 1.0)));
  float dustGate = hash01(dustId);
  if (dustGate < uDustDensity) {
    vec2 dustCenter = (vec2(dustId) + 0.5) * uDustSpacingPx;
    float dustA = 1.0 - smoothstep(0.0, 1.1, length(dust - dustCenter));
    col += vec3(uDustBrightness) * dustA * dustA;
  }

  vec2 farWorld = vWorld - uCameraCenter * (1.0 - uFarParallax);
  addLayer(
    col,
    farWorld,
    uFarCell,
    uFarRadiusPx,
    uFarDensity,
    uFarBrightness,
    ivec2(11, 23)
  );

  vec2 nearWorld = vWorld - uCameraCenter * (1.0 - uNearParallax);
  addLayer(
    col,
    nearWorld,
    uNearCell,
    uNearRadiusPx,
    uNearDensity,
    uNearBrightness,
    ivec2(41, 7)
  );

  float alpha = max(col.r, max(col.g, col.b));
  if (alpha < 0.004) discard;
  fragColor = vec4(col, min(1.0, alpha));
}
