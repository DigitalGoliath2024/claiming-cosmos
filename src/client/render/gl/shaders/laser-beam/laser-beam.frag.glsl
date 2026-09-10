#version 300 es
precision highp float;

in float vEdge;
out vec4 fragColor;

void main() {
  vec3 core = vec3(1.0, 0.16, 0.07);
  vec3 glow = vec3(1.0, 0.38, 0.14);
  float alpha = mix(0.95, 0.22, vEdge);
  fragColor = vec4(mix(core, glow, vEdge), alpha);
}
