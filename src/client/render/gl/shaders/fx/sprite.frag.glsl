#version 300 es
precision highp float;

uniform sampler2D uAtlas;

in vec2  vAtlasUV;
flat in float vAlpha;
flat in vec3  vTint;
flat in float vUseTint;

out vec4 fragColor;

void main() {
  vec4 texel = texture(uAtlas, vAtlasUV);
  if (texel.a < 0.01) discard;
  vec3 rgb = texel.rgb;
  if (vUseTint > 0.5) {
    rgb = mix(texel.rgb, vTint, 0.82) * (0.35 + texel.r * 0.85);
  }
  fragColor = vec4(rgb, texel.a * vAlpha);
}
