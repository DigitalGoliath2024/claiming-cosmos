import { assetUrl } from "../../core/AssetUrls";
import { GameEvent } from "../../core/EventBus";

export type SoundEffect =
  | "ka-ching"
  | "atom-hit"
  | "atom-launch"
  | "hydrogen-hit"
  | "hydrogen-launch"
  | "mirv-launch"
  | "alliance-suggested"
  | "alliance-broken"
  | "build-port"
  | "build-city"
  | "build-defense-post"
  | "build-warship"
  | "sam-built"
  | "silo-built"
  | "message"
  | "click";

export type AnnouncerLine =
  | "attack"
  | "warship-destroyed"
  | "marauder-destroyed"
  | "city-destroyed"
  | "port-destroyed"
  | "port-gun-destroyed"
  | "factory-destroyed"
  | "game-over";

/** Home-screen playlist (rotates; does not loop a single track forever). */
export const MENU_MUSIC_URLS: readonly string[] = [
  assetUrl("sounds/music/space-opera-home-1.mp3"),
  assetUrl("sounds/music/space-opera-home-2.mp3"),
];

/** In-game background playlist (shuffled). */
export const GAMEPLAY_MUSIC_URLS: readonly string[] = [
  assetUrl("sounds/music/deep-space-silence.mp3"),
  assetUrl("sounds/music/deep-space-silence-2.mp3"),
  assetUrl("sounds/music/deep-space-drones.mp3"),
  assetUrl("sounds/music/deep-space-watch.mp3"),
];

/**
 * Distant battle stingers under gameplay music. Drop more files in
 * `resources/sounds/ambiance/` and append paths here.
 */
export const BATTLE_AMBIANCE_URLS: readonly string[] = [
  assetUrl("sounds/ambiance/space-war-1.mp3"),
  assetUrl("sounds/ambiance/space-war-2.mp3"),
  assetUrl("sounds/ambiance/space-war-4.mp3"),
];

/** Relative to curved music gain; floor keeps stingers audible at mid music. */
export const BATTLE_AMBIANCE_MUSIC_GAIN = 0.9;
/** Minimum Howler volume when music is on (so beds don't bury the stingers). */
export const BATTLE_AMBIANCE_MIN_VOLUME = 0.22;

export const BATTLE_AMBIANCE_MIN_DELAY_MS = 12_000;
export const BATTLE_AMBIANCE_MAX_DELAY_MS = 28_000;
export const soundEffectUrls: ReadonlyMap<SoundEffect, string> = new Map([
  ["ka-ching", assetUrl("sounds/effects/ka-ching.mp3")],
  ["atom-hit", assetUrl("sounds/effects/atom-hit.mp3")],
  ["atom-launch", assetUrl("sounds/effects/atom-launch.mp3")],
  ["hydrogen-hit", assetUrl("sounds/effects/hydrogen-hit.mp3")],
  ["hydrogen-launch", assetUrl("sounds/effects/hydrogen-launch.mp3")],
  ["mirv-launch", assetUrl("sounds/effects/mirv-launch.mp3")],
  ["alliance-suggested", assetUrl("sounds/effects/alliance-suggested.mp3")],
  ["alliance-broken", assetUrl("sounds/effects/alliance-broken.mp3")],
  ["build-port", assetUrl("sounds/effects/build-port.mp3")],
  ["build-city", assetUrl("sounds/effects/build-city.mp3")],
  ["build-defense-post", assetUrl("sounds/effects/build-defense-post.mp3")],
  ["build-warship", assetUrl("sounds/effects/build-warship.mp3")],
  ["sam-built", assetUrl("sounds/effects/sam-built.mp3")],
  ["silo-built", assetUrl("sounds/effects/silo-built.mp3")],
  ["message", assetUrl("sounds/effects/message.mp3")],
  ["click", assetUrl("sounds/effects/click.mp3")],
]);

export const announcerUrls: ReadonlyMap<AnnouncerLine, string> = new Map([
  ["attack", assetUrl("sounds/announcer/attacking-enemy.mp3")],
  ["warship-destroyed", assetUrl("sounds/announcer/warship-destroyed.mp3")],
  ["marauder-destroyed", assetUrl("sounds/announcer/marauder-destroyed.wav")],
  ["city-destroyed", assetUrl("sounds/announcer/city-destroyed.mp3")],
  ["port-destroyed", assetUrl("sounds/announcer/port-destroyed.mp3")],
  ["port-gun-destroyed", assetUrl("sounds/announcer/port-gun-destroyed.mp3")],
  ["factory-destroyed", assetUrl("sounds/announcer/factory-destroyed.mp3")],
  ["game-over", assetUrl("sounds/announcer/game-over.mp3")],
]);

export class PlaySoundEffectEvent implements GameEvent {
  constructor(public readonly effect: SoundEffect) {}
}

export class SetSoundEffectsVolumeEvent implements GameEvent {
  constructor(public readonly volume: number) {}
}

export class SetBackgroundMusicVolumeEvent implements GameEvent {
  constructor(public readonly volume: number) {}
}

export class PlayAnnouncerEvent implements GameEvent {
  constructor(public readonly line: AnnouncerLine) {}
}

export class SetAnnouncerVolumeEvent implements GameEvent {
  constructor(public readonly volume: number) {}
}
