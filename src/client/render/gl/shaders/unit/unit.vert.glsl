#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;

// Per-instance attributes
layout(location = 1) in vec3 aInstPos;   // x, y, ownerID
layout(location = 2) in vec4 aInstFlags; // atlasIdx, flags, flickerHash, style (uint8→float)

uniform mat3  uCamera;

uniform float uUnitSize;
uniform float uShipScale; // sea/void hulls only — keeps nukes and trains at unitSize
uniform float uHBombGlowScale; // quad enlargement for the hydrogen bomb glow halo

out vec2  vQuadPos;     // quad coords [0,1] — drives the radial glow falloff
out vec2  vCellUV;      // sprite cell coords; the central 1/scale region is the sprite
out vec2  vWorldPos;    // world-space tile coords — drives the train effect's gradient
flat out float vAtlasCol;
flat out float vOwnerID;
flat out float vFlags;  // 0.0 = normal, 1.0 = flicker, 2.0 = angry
flat out float vHash;   // per-instance hash for flicker phase offset
flat out float vGlow;   // 1.0 if this instance is a hydrogen bomb (draw glow), else 0.0
flat out float vStyle;  // 0 = default hull, 1 = marauder (smaller, remapped bands)

void main() {
  float worldX = aInstPos.x;
  float worldY = aInstPos.y;
  vOwnerID = aInstPos.z;

  float atlasCol = aInstFlags.x;
  vFlags = aInstFlags.y;
  vAtlasCol = atlasCol;
  // Bit 0 = marauder hull remap; bits 1–5 = 32-way heading (ships and trains).
  vStyle = mod(aInstFlags.w, 2.0);

  // Per-instance hash so each unit flickers independently. Computed CPU-side
  // from the tick position — hashing worldX/Y here would re-roll the phase
  // every frame for nukes whose position is smoothed per frame.
  vHash = aInstFlags.z * (1.0 / 255.0);

  // Hydrogen bombs render an enlarged quad so there's room for a glow halo
  // around the sprite. All other units keep scale 1 (no behavior change).
  float isHBomb = step(abs(atlasCol - float(HYDROGEN_BOMB_COL)), 0.5);
  vGlow = isHBomb;
  float uvScale = mix(1.0, uHBombGlowScale, isHBomb);
  float isTransport = 1.0 - step(0.5, abs(atlasCol - float(TRANSPORT_COL)));
  float isLander = 1.0 - step(0.5, abs(atlasCol - float(LANDER_COL)));
  float isTrade = 1.0 - step(0.5, abs(atlasCol - float(TRADE_SHIP_COL)));
  float isTender = 1.0 - step(0.5, abs(atlasCol - float(TENDER_COL)));
  float isVoidship = 1.0 - step(0.5, abs(atlasCol - float(VOIDSHIP_COL)));
  float isCorsair = 1.0 - step(0.5, abs(atlasCol - float(CORSAIR_COL)));
  float isLancer = 1.0 - step(0.5, abs(atlasCol - float(LANCER_COL)));
  float isShip = 1.0 - step(float(SHIP_LAST_COL) + 0.5, atlasCol);
  float sizeScale = uvScale
    * mix(1.0, 0.5, isTransport)
    * mix(1.0, 0.5, isLander)
    * mix(1.0, 0.4, isTrade)
    * mix(1.0, 0.62, step(0.5, vStyle))
    * mix(1.0, 1.18, isVoidship)
    * mix(1.0, 0.86, isCorsair)
    * mix(1.0, 0.86, isLancer)
    * mix(1.0, uShipScale, isShip);

  // UNIT_SIZE is in world-space tiles — no zoom division needed.
  // Units scale with the map like territory tiles do.
  float halfSize = uUnitSize * 0.5 * sizeScale;

  vec2 center = vec2(worldX + 0.5, worldY + 0.5);
  vec2 local = (aPos - 0.5) * halfSize * 2.0;
  // Tender is two pixels longer than a warship along the keel (bow-east).
  local.x *= mix(1.0, 15.0 / 13.0, isTender);
  // Sea hulls (atlas cols 0–SHIP_LAST_COL) and trains (engine + cars) are
  // drawn facing east; style bits 1–5 pack a 32-direction heading.
  float isTrain = step(float(TRAIN_FIRST_COL) - 0.5, atlasCol);
  float heading = floor(aInstFlags.w * 0.5 + 0.001);
  float ang = heading * 6.283185307179586 / float(HEADING_STEPS);
  float ca = cos(ang);
  float sa = sin(ang);
  local = mix(
    local,
    vec2(ca * local.x - sa * local.y, sa * local.x + ca * local.y),
    max(isShip, isTrain)
  );
  vec2 worldPos = center + local;
  vWorldPos = worldPos;

  vec3 clip = uCamera * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);

  vQuadPos = aPos;

  // Map the enlarged quad back to sprite cell space: the central 1/scale
  // portion is the sprite, anything outside [0,1] is glow-only margin.
  vCellUV = (aPos - 0.5) * uvScale + 0.5;
}
