import { Howl } from "howler";
import { EventBus } from "../../core/EventBus";
import {
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "../../core/game/UserSettings";
import {
  announcerUrls,
  GAMEPLAY_MUSIC_URLS,
  MENU_MUSIC_URLS,
  PlayAnnouncerEvent,
  PlaySoundEffectEvent,
  SetAnnouncerVolumeEvent,
  SetBackgroundMusicVolumeEvent,
  SetSoundEffectsVolumeEvent,
  AnnouncerLine,
  SoundEffect,
  soundEffectUrls,
} from "./Sounds";

export const MAX_CONCURRENT_SOUNDS = 8;

/** Home playlist plus shuffled in-game playlist. */
export const MUSIC_HOWLS = MENU_MUSIC_URLS.length + GAMEPLAY_MUSIC_URLS.length;

type MusicMode = "menu" | "game";

function shuffleOrder(n: number, avoidFirst?: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  if (
    avoidFirst !== undefined &&
    avoidFirst >= 0 &&
    n > 1 &&
    order[0] === avoidFirst
  ) {
    const tmp = order[0];
    order[0] = order[1];
    order[1] = tmp;
  }
  return order;
}

export class SoundManager {
  private menuMusic: Howl[] = [];
  private menuOrder: number[] = [];
  private menuIndex = 0;
  private lastMenuTrack = -1;
  private gameplayMusic: Howl[] = [];
  private gameplayOrder: number[] = [];
  private gameplayIndex = 0;
  private lastGameplayTrack = -1;
  private mode: MusicMode = "menu";
  private soundEffects: Map<SoundEffect, Howl> = new Map();
  private announcerLines: Map<AnnouncerLine, Howl> = new Map();
  private soundEffectsVolume: number = 1;
  private announcerVolume: number = 1;
  private backgroundMusicVolume: number = 0;
  private activeSounds: { howl: Howl; id: number }[] = [];
  private eventBus: EventBus;
  private onPlaySoundEffect: (e: PlaySoundEffectEvent) => void;
  private onSetBackgroundMusicVolume: (
    e: SetBackgroundMusicVolumeEvent,
  ) => void;
  private onSetSoundEffectsVolume: (e: SetSoundEffectsVolumeEvent) => void;
  private onPlayAnnouncer: (e: PlayAnnouncerEvent) => void;
  private onSetAnnouncerVolume: (e: SetAnnouncerVolumeEvent) => void;
  private onUnlockAudio: () => void;
  private onStoredMusicVolume: (e: Event) => void;
  private onStoredSfxVolume: (e: Event) => void;
  private onStoredAnnouncerVolume: (e: Event) => void;

  constructor(eventBus: EventBus, userSettings: UserSettings) {
    this.eventBus = eventBus;
    this.safely("initialize menu music", () => {
      this.menuMusic = MENU_MUSIC_URLS.map(
        (src) =>
          new Howl({
            src: [src],
            loop: false,
            volume: 0,
            onend: () => this.onMenuTrackEnded(),
          }),
      );
    });
    this.safely("initialize gameplay music", () => {
      this.gameplayMusic = GAMEPLAY_MUSIC_URLS.map(
        (src) =>
          new Howl({
            src: [src],
            loop: false,
            volume: 0,
            onend: () => this.onGameplayTrackEnded(),
          }),
      );
    });
    this.setBackgroundMusicVolume(userSettings.backgroundMusicVolume());
    this.setSoundEffectsVolume(userSettings.soundEffectsVolume());
    this.setAnnouncerVolume(userSettings.announcerVolume());
    this.onPlaySoundEffect = (e) => this.playSoundEffect(e.effect);
    this.onPlayAnnouncer = (e) => this.playAnnouncer(e.line);
    this.onSetBackgroundMusicVolume = (e) =>
      this.setBackgroundMusicVolume(e.volume);
    this.onSetSoundEffectsVolume = (e) => this.setSoundEffectsVolume(e.volume);
    this.onSetAnnouncerVolume = (e) => this.setAnnouncerVolume(e.volume);
    eventBus.on(PlaySoundEffectEvent, this.onPlaySoundEffect);
    eventBus.on(PlayAnnouncerEvent, this.onPlayAnnouncer);
    eventBus.on(SetBackgroundMusicVolumeEvent, this.onSetBackgroundMusicVolume);
    eventBus.on(SetSoundEffectsVolumeEvent, this.onSetSoundEffectsVolume);
    eventBus.on(SetAnnouncerVolumeEvent, this.onSetAnnouncerVolume);

    this.onStoredMusicVolume = (e: Event) => {
      const n = parseFloat(String((e as CustomEvent).detail));
      if (Number.isFinite(n)) this.setBackgroundMusicVolume(n);
    };
    this.onStoredSfxVolume = (e: Event) => {
      const n = parseFloat(String((e as CustomEvent).detail));
      if (Number.isFinite(n)) this.setSoundEffectsVolume(n);
    };
    this.onStoredAnnouncerVolume = (e: Event) => {
      const n = parseFloat(String((e as CustomEvent).detail));
      if (Number.isFinite(n)) this.setAnnouncerVolume(n);
    };
    globalThis.addEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.backgroundMusicVolume`,
      this.onStoredMusicVolume,
    );
    globalThis.addEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.soundEffectsVolume`,
      this.onStoredSfxVolume,
    );
    globalThis.addEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.announcerVolume`,
      this.onStoredAnnouncerVolume,
    );

    this.onUnlockAudio = () => {
      if (this.mode === "menu") {
        this.playMenuMusic(false);
      } else {
        this.playGameplayMusic(false);
      }
    };
    globalThis.addEventListener?.("pointerdown", this.onUnlockAudio, {
      once: true,
      capture: true,
    });
  }

  public dispose(): void {
    this.eventBus.off(PlaySoundEffectEvent, this.onPlaySoundEffect);
    this.eventBus.off(PlayAnnouncerEvent, this.onPlayAnnouncer);
    this.eventBus.off(
      SetBackgroundMusicVolumeEvent,
      this.onSetBackgroundMusicVolume,
    );
    this.eventBus.off(SetSoundEffectsVolumeEvent, this.onSetSoundEffectsVolume);
    this.eventBus.off(SetAnnouncerVolumeEvent, this.onSetAnnouncerVolume);
    globalThis.removeEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.backgroundMusicVolume`,
      this.onStoredMusicVolume,
    );
    globalThis.removeEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.soundEffectsVolume`,
      this.onStoredSfxVolume,
    );
    globalThis.removeEventListener?.(
      `${USER_SETTINGS_CHANGED_EVENT}:settings.announcerVolume`,
      this.onStoredAnnouncerVolume,
    );
    globalThis.removeEventListener?.("pointerdown", this.onUnlockAudio, {
      capture: true,
    } as EventListenerOptions);
    this.stopAllMusic();
    this.menuMusic.forEach((track) => {
      this.safely("unload menu track", () => track.unload());
    });
    this.gameplayMusic.forEach((track) => {
      this.safely("unload gameplay track", () => track.unload());
    });
    this.soundEffects.forEach((sound) => {
      this.safely("stop sound effect", () => sound.stop());
      this.safely("unload sound effect", () => sound.unload());
    });
    this.announcerLines.forEach((sound) => {
      this.safely("stop announcer line", () => sound.stop());
      this.safely("unload announcer line", () => sound.unload());
    });
    this.soundEffects.clear();
    this.announcerLines.clear();
    this.activeSounds = [];
  }

  private safely(action: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.error(`SoundManager: failed to ${action}`, err);
    }
  }

  /** Shuffle and play the home-screen playlist. Pass false to resume after autoplay unlock. */
  public playMenuMusic(reshuffle: boolean = true): void {
    this.mode = "menu";
    this.stopGameplay();
    if (reshuffle || this.menuOrder.length === 0) {
      this.menuOrder = shuffleOrder(this.menuMusic.length, this.lastMenuTrack);
      this.menuIndex = 0;
    }
    this.playCurrentMenu();
  }

  /** Shuffle and play the in-game playlist. Pass false to resume the current track after autoplay unlock. */
  public playGameplayMusic(reshuffle: boolean = true): void {
    this.mode = "game";
    this.stopMenu();
    if (reshuffle || this.gameplayOrder.length === 0) {
      this.gameplayOrder = shuffleOrder(
        this.gameplayMusic.length,
        this.lastGameplayTrack,
      );
      this.gameplayIndex = 0;
    }
    this.playCurrentGameplay();
  }

  /** @deprecated Use playGameplayMusic — kept for in-game start(). */
  public playBackgroundMusic(): void {
    this.playGameplayMusic();
  }

  public stopBackgroundMusic(): void {
    this.stopAllMusic();
  }

  private stopAllMusic(): void {
    this.stopMenu();
    this.stopGameplay();
  }

  private stopMenu(): void {
    this.safely("stop menu music", () => {
      this.menuMusic.forEach((track) => track.stop());
    });
  }

  private stopGameplay(): void {
    this.safely("stop gameplay music", () => {
      this.gameplayMusic.forEach((track) => track.stop());
    });
  }

  private playCurrentMenu(): void {
    if (this.mode !== "menu" || this.menuOrder.length === 0) return;
    const trackIndex = this.menuOrder[this.menuIndex];
    const track = this.menuMusic[trackIndex];
    if (!track) return;
    this.lastMenuTrack = trackIndex;
    this.safely("play menu music", () => {
      if (!track.playing()) {
        track.play();
      }
    });
  }

  private onMenuTrackEnded(): void {
    if (this.mode !== "menu") return;
    this.menuIndex++;
    if (this.menuIndex >= this.menuOrder.length) {
      this.menuOrder = shuffleOrder(this.menuMusic.length, this.lastMenuTrack);
      this.menuIndex = 0;
    }
    this.playCurrentMenu();
  }

  private playCurrentGameplay(): void {
    if (this.mode !== "game" || this.gameplayOrder.length === 0) return;
    const trackIndex = this.gameplayOrder[this.gameplayIndex];
    const track = this.gameplayMusic[trackIndex];
    if (!track) return;
    this.lastGameplayTrack = trackIndex;
    this.safely("play gameplay music", () => {
      if (!track.playing()) {
        track.play();
      }
    });
  }

  private onGameplayTrackEnded(): void {
    if (this.mode !== "game") return;
    this.gameplayIndex++;
    if (this.gameplayIndex >= this.gameplayOrder.length) {
      this.gameplayOrder = shuffleOrder(
        this.gameplayMusic.length,
        this.lastGameplayTrack,
      );
      this.gameplayIndex = 0;
    }
    this.playCurrentGameplay();
  }

  // Slider positions are linear (0–1) but perceived loudness is roughly
  // logarithmic, so feeding the position straight to Howler makes the top of
  // the range sound identical. Square the position for an audio-taper curve.
  private perceptualGain(position: number): number {
    const clamped = Math.max(0, Math.min(1, position));
    return clamped * clamped;
  }

  public setBackgroundMusicVolume(volume: number): void {
    this.backgroundMusicVolume = this.perceptualGain(volume);
    this.safely("set background music volume", () => {
      this.menuMusic.forEach((track) => {
        track.volume(this.backgroundMusicVolume);
      });
      this.gameplayMusic.forEach((track) => {
        track.volume(this.backgroundMusicVolume);
      });
    });
  }

  private getOrLoadSoundEffect(name: SoundEffect): Howl | null {
    let sound = this.soundEffects.get(name);
    if (sound) return sound;
    const src = soundEffectUrls.get(name);
    if (!src) return null;
    try {
      sound = new Howl({ src: [src], volume: this.soundEffectsVolume });
      this.soundEffects.set(name, sound);
      return sound;
    } catch (err) {
      console.error(`SoundManager: failed to load sound ${name}`, err);
      return null;
    }
  }

  private removeActiveSoundById(id: number): void {
    this.activeSounds = this.activeSounds.filter((s) => s.id !== id);
  }

  public playSoundEffect(name: SoundEffect): void {
    this.safely(`play sound ${name}`, () => {
      const howl = this.getOrLoadSoundEffect(name);
      if (!howl) return;

      if (this.activeSounds.length >= MAX_CONCURRENT_SOUNDS) {
        const oldest = this.activeSounds[0];
        oldest.howl.stop(oldest.id);
        this.removeActiveSoundById(oldest.id);
      }

      const id = howl.play();
      this.activeSounds.push({ howl, id });
      howl.once("end", () => this.removeActiveSoundById(id), id);
      howl.once("stop", () => this.removeActiveSoundById(id), id);
    });
  }

  public setSoundEffectsVolume(volume: number): void {
    this.soundEffectsVolume = this.perceptualGain(volume);
    this.safely("set sound effects volume", () => {
      this.soundEffects.forEach((sound) => {
        sound.volume(this.soundEffectsVolume);
      });
    });
  }

  public setAnnouncerVolume(volume: number): void {
    this.announcerVolume = this.perceptualGain(volume);
    this.safely("set announcer volume", () => {
      this.announcerLines.forEach((sound) => {
        sound.volume(this.announcerVolume);
      });
    });
  }

  private getOrLoadAnnouncer(line: AnnouncerLine): Howl | null {
    let sound = this.announcerLines.get(line);
    if (sound) return sound;
    const src = announcerUrls.get(line);
    if (!src) return null;
    try {
      sound = new Howl({ src: [src], volume: this.announcerVolume });
      this.announcerLines.set(line, sound);
      return sound;
    } catch (err) {
      console.error(`SoundManager: failed to load announcer ${line}`, err);
      return null;
    }
  }

  public playAnnouncer(line: AnnouncerLine): void {
    this.safely(`play announcer ${line}`, () => {
      this.announcerLines.forEach((sound) => sound.stop());
      const howl = this.getOrLoadAnnouncer(line);
      if (!howl) return;
      howl.play();
    });
  }

  public stopSoundEffect(name: SoundEffect): void {
    this.safely(`stop sound ${name}`, () => {
      const howl = this.soundEffects.get(name);
      if (howl) {
        howl.stop();
        this.activeSounds = this.activeSounds.filter((s) => s.howl !== howl);
      }
    });
  }
}
