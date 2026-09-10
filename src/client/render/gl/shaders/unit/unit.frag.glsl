#version 300 es
precision highp float;

uniform sampler2D uPalette;
uniform sampler2D uAtlas;
uniform sampler2D uAffiliation;   // 256×2 RGBA8 — row 1 = unit affiliation
uniform sampler2D uEffect;        // RGBA32F — shared effect palette, keyed by
                                  //   ownerID. The warship block starts at row
                                  //   WARSHIP_EFFECT_ROW_BASE and the train
                                  //   block at TRAIN_EFFECT_ROW_BASE; same
                                  //   layout as trail/structure.frag.glsl (row r =
                                  //   color r's rgb; row 0.a = count,
                                  //   1.a = styleId, 2.a = scalar0,
                                  //   3.a = scalar1)
uniform float uTime;              // seconds, for animated effect styles
uniform float uTick;
uniform float uFlickerSpeed;
uniform vec3  uAngryColor;
uniform int   uAltView;
uniform vec3  uSelfColor;         // affiliation self/ally colors (alt-view trade ships)
uniform vec3  uAllyColor;
uniform vec3  uHBombGlowColor;
uniform float uHBombGlowStrength;
uniform float uHBombGlowInner;
uniform float uUntargetableAlpha;

in vec2  vQuadPos;
in vec2  vCellUV;
in vec2  vWorldPos;
flat in float vAtlasCol;
flat in float vOwnerID;
flat in float vFlags;
flat in float vHash;
flat in float vGlow;
flat in float vStyle;

out vec4 fragColor;

// Flag constants — must match CPU-side FLAG_* values
const float FLAG_FLICKER        = 1.0;
const float FLAG_ANGRY          = 2.0;
const float FLAG_TRADE_FRIENDLY = 3.0;
const float FLAG_RETREATING     = 4.0;
const float FLAG_FLICKER_UNTARGETABLE = 5.0; // nuke out of SAM range — dimmed
const float FLAG_TRADE_SELF     = 6.0;
const float FLAG_NAVAL_MINE     = 7.0;

// Flicker hot colors: red → orange → yellow → white
const vec3 FLICKER_COLORS[4] = vec3[4](
  vec3(1.0, 0.0, 0.0),   // red
  vec3(1.0, 0.5, 0.0),   // orange
  vec3(1.0, 1.0, 0.0),   // yellow
  vec3(1.0, 1.0, 1.0)    // white
);

// The owner's sprite cosmetic color, if equipped, from the effect-palette
// block starting at row rowBase (the warship or train block). Returns false
// when the owner has no effect in that block (count 0).
//
// `coord` positions the gradient: with iconSpace the caller passes the sprite
// diagonal in 0..1 (the palette spans the sprite once, sliding one cycle every
// colorSize · count / movementSpeed seconds — structure.frag.glsl semantics);
// otherwise it passes the world diagonal x + y (colorSize = band width in
// tiles, movementSpeed = tiles/sec — trail.frag.glsl semantics).
bool spriteEffectColor(int rowBase, int owner, float coord, bool iconSpace, out vec3 color) {
  int count = int(texelFetch(uEffect, ivec2(owner, rowBase), 0).a + 0.5);
  if (count <= 0) return false;
  if (count == 1) {
    // Single color — flat recolor.
    color = texelFetch(uEffect, ivec2(owner, rowBase), 0).rgb;
  } else if (int(texelFetch(uEffect, ivec2(owner, rowBase + 1), 0).a + 0.5) == 1) {
    // transition — one color at a time, cross-fading through the list.
    // frequency = color changes per second.
    float frequency = texelFetch(uEffect, ivec2(owner, rowBase + 2), 0).a;
    float t = uTime * frequency;
    int i = int(t) % count;
    int j = (i + 1) % count;
    vec3 a = texelFetch(uEffect, ivec2(owner, rowBase + i), 0).rgb;
    vec3 b = texelFetch(uEffect, ivec2(owner, rowBase + j), 0).rgb;
    color = mix(a, b, fract(t));
  } else {
    // gradient — cyclic palette along `coord` (see above), scrolling over
    // time.
    float colorSize = max(texelFetch(uEffect, ivec2(owner, rowBase + 2), 0).a, 0.001);
    float movementSpeed = texelFetch(uEffect, ivec2(owner, rowBase + 3), 0).a;
    float cycle = colorSize * float(count);
    float c = iconSpace ? coord : coord / cycle;
    float phase = fract(c - uTime * movementSpeed / cycle);
    float f = phase * float(count);
    int i = int(f) % count;
    int j = (i + 1) % count;
    vec3 a = texelFetch(uEffect, ivec2(owner, rowBase + i), 0).rgb;
    vec3 b = texelFetch(uEffect, ivec2(owner, rowBase + j), 0).rgb;
    color = mix(a, b, fract(f));
  }
  return true;
}

void main() {
  // Untargetable nukes render translucent so players know SAMs can't hit them
  float alphaMul = abs(vFlags - FLAG_FLICKER_UNTARGETABLE) < 0.1
    ? uUntargetableAlpha
    : 1.0;

  // The sprite lives in the central cell-space region [0,1]; for the enlarged
  // hydrogen-bomb quad, anything outside that range is glow-only margin.
  vec4 texel = vec4(0.0);
  bool inSprite = vCellUV.x >= 0.0 && vCellUV.x <= 1.0 &&
                  vCellUV.y >= 0.0 && vCellUV.y <= 1.0;
  if (inSprite) {
    vec2 atlasUV = vec2((vAtlasCol + vCellUV.x) / float(ATLAS_COLS), vCellUV.y);
    texel = texture(uAtlas, atlasUV);
  }

  // Outside the sprite: render the steady soft glow under the hydrogen bomb,
  // otherwise discard. Glow is suppressed in alt (affiliation) view.
  if (texel.a < 0.01) {
    if (vGlow > 0.5 && uAltView == 0) {
      float d = length(vQuadPos - 0.5) * 2.0; // 0 at center → ~1 at quad edge
      float g = (1.0 - smoothstep(uHBombGlowInner, 1.0, d)) * uHBombGlowStrength;
      if (g > 0.001) {
        fragColor = vec4(uHBombGlowColor, g * alphaMul);
        return;
      }
    }
    discard;
  }

  // Naval mines reuse the 1×1 shell sprite and would otherwise take player
  // color (or affiliation color in alt-view) and vanish on ocean.
  if (abs(vFlags - FLAG_NAVAL_MINE) < 0.1) {
    fragColor = vec4(0.0, 0.0, 0.0, texel.a * alphaMul);
    return;
  }

  float gray = texel.r;
  bool isTrainEngine = abs(vAtlasCol - float(TRAIN_FIRST_COL)) < 0.1;

  // Top-down locomotive: draw atlas RGB as-is (black / yellow / grays / orange).
  // Carriages stay owner-tinted.
  if (isTrainEngine) {
    fragColor = vec4(texel.rgb, texel.a * alphaMul);
    return;
  }

  // Yellow window pixels (painted RGB yellow) stay yellow — not engines.
  if (texel.r > 0.7 && texel.g > 0.5 && texel.b < 0.35) {
    fragColor = vec4(1.0, 0.85, 0.12, texel.a * alphaMul);
    return;
  }

  // Weapon-tip red (Corsair guns) — not remapped to player or steel.
  if (texel.r > 0.6 && texel.g < 0.25 && texel.b < 0.25) {
    fragColor = vec4(0.95, 0.14, 0.10, texel.a * alphaMul);
    return;
  }

  // White engine pixels flash one of three cool palettes, picked by a
  // stable per-unit hash so a fleet isn't one identical swirl.
  if (gray > 0.98) {
    float pulse = step(0.5, fract(uTime * 2.4 + vHash * 2.0 + (vCellUV.x + vCellUV.y) * 3.0));
    int variant = int(vHash * 3.0);
    vec3 c0 = vec3(0.12, 0.78, 1.0);
    vec3 c1 = vec3(0.18, 1.0, 0.38);
    if (variant == 1) {
      c0 = vec3(0.22, 0.42, 1.0);
      c1 = vec3(0.12, 1.0, 0.72);
    } else if (variant == 2) {
      c0 = vec3(0.05, 0.95, 0.88);
      c1 = vec3(0.55, 1.0, 0.22);
    }
    fragColor = vec4(mix(c0, c1, pulse), texel.a * alphaMul);
    return;
  }

  // Steel hull (200) and bright plating (230) stay gray on black void.
  // White 255 is reserved for the flashing engine.
  if (gray > 0.88) {
    fragColor = vec4(vec3(0.88, 0.90, 0.94), texel.a * alphaMul);
    return;
  }
  if (gray > 0.75) {
    fragColor = vec4(vec3(0.58, 0.62, 0.70), texel.a * alphaMul);
    return;
  }

  // Alt-view: solid affiliation color, no gray-replacement bands
  if (uAltView != 0) {
    // Trade ships: green if self is on either end, yellow if an ally is
    vec3 ac = abs(vFlags - FLAG_TRADE_SELF) < 0.1
      ? uSelfColor
      : abs(vFlags - FLAG_TRADE_FRIENDLY) < 0.1
        ? uAllyColor
        : texelFetch(uAffiliation, ivec2(int(vOwnerID), 1), 0).rgb;
    fragColor = vec4(ac, texel.a * alphaMul);
    return;
  }

  // Player color lookup from palette
  float u = (vOwnerID + 0.5) / float(PALETTE_SIZE);
  vec3 territoryColor = texture(uPalette, vec2(u, 0.25)).rgb;
  vec3 borderColor    = texture(uPalette, vec2(u, 0.75)).rgb;

  // warship cosmetic: recolor the warship's territory-color bands with the
  // owner's effect (raw catalog colors, like trails). The border band keeps
  // the player color so ownership stays readable, and combat signals win: the
  // angry (attacking) override below replaces this with red, and the retreat
  // blink still darkens the center band.
  if (abs(vAtlasCol - float(WARSHIP_COL)) < 0.1 ||
      abs(vAtlasCol - float(MARAUDER_COL)) < 0.1 ||
      abs(vAtlasCol - float(TENDER_COL)) < 0.1 ||
      abs(vAtlasCol - float(VOIDSHIP_COL)) < 0.1 ||
      abs(vAtlasCol - float(CORSAIR_COL)) < 0.1 ||
      abs(vAtlasCol - float(LANCER_COL)) < 0.1 ||
      abs(vAtlasCol - float(VESTAL_COL)) < 0.1) {
    vec3 effectRGB;
    float dn = (vCellUV.x + vCellUV.y) * 0.5; // sprite diagonal, 0..1
    if (spriteEffectColor(WARSHIP_EFFECT_ROW_BASE, int(vOwnerID + 0.5), dn, true, effectRGB)) {
      territoryColor = effectRGB;
    }
  }

  // train cosmetic: carriages only (the engine stays iron). Carriages are a
  // border-band frame around a territory-band fill, so recolor both bands —
  // the border band darkened — while the consist takes the effect.
  // The gradient is world-space (like trails and the railroad effect): the
  // 5×5 train sprites fill only the middle of the 13-tile unit cell, so an
  // icon-space gradient would show a sliver of the palette per car, whereas a
  // world-space one runs along the whole train.
  if (vAtlasCol > float(TRAIN_FIRST_COL) + 0.5) {
    vec3 effectRGB;
    float diag = vWorldPos.x + vWorldPos.y;
    if (spriteEffectColor(TRAIN_EFFECT_ROW_BASE, int(vOwnerID + 0.5), diag, false, effectRGB)) {
      territoryColor = effectRGB;
      borderColor = effectRGB * 0.6;
    }
  }

  // Flag states (uint8 passed as float via vertex attribute):
  //   0 = normal
  //   1 = flicker (nukes/warheads — cycling hot colors)
  //   2 = angry (warships attacking — outer ring (180 band) solid red)
  //   4 = retreating (warships fleeing to port — blinking black center)
  float retreatBlink = 0.0;
  if (abs(vFlags - FLAG_ANGRY) < 0.1) {
    // Angry: the outer ring (180) and center (100) go red via territoryColor
    territoryColor = uAngryColor;
  } else if (abs(vFlags - FLAG_RETREATING) < 0.1) {
    // Retreating: slowly blink the center (100 band) black so the ship reads as fleeing
    retreatBlink = step(0.5, fract(uTick * 0.07));
  } else if (abs(vFlags - FLAG_FLICKER) < 0.1 ||
             abs(vFlags - FLAG_FLICKER_UNTARGETABLE) < 0.1) {
    // Flicker: cycle through hot colors, offset by position hash
    float phase = fract(uTick * uFlickerSpeed + vHash);
    int idx = int(phase * 4.0) % 4;
    territoryColor = FLICKER_COLORS[idx];
    borderColor = FLICKER_COLORS[(idx + 2) % 4];
  }

  // Gray replacement:
  //   180/255 ~ 0.706 -> territory color (light band)
  //   130/255 ~ 0.510 -> spawn/mid color (interpolated; used by missiles)
  //   100/255 ~ 0.392 -> center accent (warship center — tracks ring, blinks black)
  //   70/255  ~ 0.275 -> border color (dark band)
  //   48/255  ~ 0.188 -> fixed dark gray (not player-tinted)
  //   20/255  ~ 0.078 -> black detail
  vec3 spawnColor = mix(territoryColor, borderColor, 0.5);
  vec3 centerColor = mix(territoryColor, vec3(0.0), retreatBlink);
  vec3 shadeGray = vec3(0.42);

  vec3 color;
  if (vStyle > 0.5) {
    // Marauder: same four player colors, inverted rings so the hull reads as
    // a dark shell with a bright mid-band instead of a bright outer ring.
    if (gray > 0.6) {
      color = abs(vFlags - FLAG_ANGRY) < 0.1 ? territoryColor : borderColor;
    } else if (gray > 0.45) {
      color = territoryColor;
    } else if (gray > 0.34) {
      color = mix(borderColor, vec3(0.0), retreatBlink);
    } else if (gray > 0.22) {
      color = spawnColor;
    } else if (gray > 0.12) {
      color = shadeGray;
    } else {
      color = vec3(0.0);
    }
  } else if (gray > 0.6) {
    // Light band (180) -> territory color
    color = territoryColor;
  } else if (gray > 0.45) {
    // Mid band (130) -> spawn color
    color = spawnColor;
  } else if (gray > 0.34) {
    // Center accent band (100) -> center color
    color = centerColor;
  } else if (gray > 0.22) {
    // Dark band (70) -> border color
    color = borderColor;
  } else if (gray > 0.12) {
    // Dark-gray detail — stays gray so bright player colors don't wash out
    color = shadeGray;
  } else {
    // Black detail
    color = vec3(0.0);
  }

  fragColor = vec4(color, texel.a * alphaMul);
}
