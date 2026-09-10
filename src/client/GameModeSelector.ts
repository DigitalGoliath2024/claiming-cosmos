import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientEnv } from "src/client/ClientEnv";
import { UserMeResponse } from "../core/ApiSchemas";
import { assetUrl } from "../core/AssetUrls";
import {
  Duos,
  GameMapType,
  GameMode,
  GameType,
  HumansVsNations,
  Quads,
  Trios,
} from "../core/game/Game";
import { isPlayableMapType } from "../core/game/PlayableMaps";
import {
  PublicGameInfo,
  PublicGames,
  SCHEDULED_PUBLIC_GAME_TYPES,
} from "../core/Schemas";
import { getDesktopSessionState } from "./Auth";
import "./components/CosmeticBackground";
import "./components/IOSAddToHomeScreenBanner";
import {
  canJoinTrustedLobby,
  lobbyCard,
  mapAspectRatios,
  trustRequiredDialog,
  viewerIsSignedIn,
  viewerIsTrusted,
} from "./components/LobbyCard";
import "./components/NewsBox";
import "./components/StreamingNow";
import { crazyGamesSDK } from "./CrazyGamesSDK";
import {
  isDesktopShell,
  multiplayerAllowed,
  multiplayerAllowedForSession,
  type DesktopSessionState,
  type DesktopUpdateState,
} from "./DesktopShell";
import { HostLobbyModal } from "./HostLobbyModal";
import { JoinLobbyModal } from "./JoinLobbyModal";
import { PublicLobbySocket } from "./LobbySocket";
import { JoinLobbyEvent } from "./Main";
import { SinglePlayerModal } from "./SinglePlayerModal";
import { UsernameInput } from "./UsernameInput";
import {
  calculateServerTimeOffset,
  getSecondsUntilServerTimestamp,
  renderDuration,
  translateText,
} from "./Utils";

const CARD_BG = "bg-surface";
const ACTION_BTN =
  "bg-white/10 hover:bg-white/15 active:bg-white/5 hover:scale-[1.02] hover:shadow-[var(--shadow-action-card-hover)] text-white";
const SOLO_BTN =
  "bg-malibu-blue hover:bg-aquarius active:bg-malibu-blue/80 hover:scale-[1.02] !text-white";

/**
 * Whether a multiplayer entry point should refuse to act. Exported for tests
 * and kept free of component state so the rule is checkable in isolation.
 * A null state means that bridge is absent (the web build), so it gates
 * nothing; either state alone is enough to block.
 */
export function shouldBlockMultiplayerAction(
  update: DesktopUpdateState | null,
  session: DesktopSessionState | null,
): boolean {
  if (update !== null && !multiplayerAllowed(update)) return true;
  if (session !== null && !multiplayerAllowedForSession(session)) return true;
  return false;
}

/**
 * Whether the desktop gate applies to a given join at all. Single-player runs
 * entirely in-client and a replay simulates from an archived record, so
 * neither needs a session or an up-to-date build. getTurnstileToken in
 * Main.ts exempts the same pair (alongside two conditions irrelevant here),
 * and calls this so the two cannot drift. Exported for tests and kept free of
 * component state, like shouldBlockMultiplayerAction above.
 */
export function joinIsGateable(lobby: JoinLobbyEvent): boolean {
  return (
    lobby.gameStartInfo?.config.gameType !== GameType.Singleplayer &&
    lobby.gameRecord === undefined
  );
}

/**
 * The whole gate decision for one join, as a pure function so it is testable
 * without mounting Main's client. Main adds only the shell check and the
 * status-bar wiggle around it.
 */
export function shouldBlockDesktopJoin(
  lobby: JoinLobbyEvent,
  update: DesktopUpdateState | null,
  session: DesktopSessionState | null,
): boolean {
  if (!joinIsGateable(lobby)) return false;
  return shouldBlockMultiplayerAction(update, session);
}

/** Live countdown games shown first on the homepage. */
export const FEATURED_FILLING_COUNT = 3;
/** Queued public games shown after the filling row, labeled "Up next". */
export const FEATURED_UP_NEXT_COUNT = 3;
export const FEATURED_LOBBY_COUNT =
  FEATURED_FILLING_COUNT + FEATURED_UP_NEXT_COUNT;

export interface FeaturedLobby {
  lobby: PublicGameInfo;
  upNext: boolean;
}

/**
 * Homepage lobby cards: the three games currently filling, then the three
 * queued behind them.
 *
 * Filling is the live lobby for each scheduled type (ffa / team / special) —
 * the one with startsAt, else the front of that type's advertised list —
 * ordered by soonest startsAt. Up next walks the same per-type queues in
 * lockstep so the second row stays one of each type rather than three FFAs.
 * Hosted listings are omitted; they are not part of the master's public queue.
 * Earth / non-cosmic maps are skipped so the ticker only shows space maps.
 */
function isSpaceLobby(lobby: PublicGameInfo): boolean {
  const map = lobby.gameConfig?.gameMap;
  return map !== undefined && isPlayableMapType(map as GameMapType);
}

export function selectFeaturedLobbies(
  games: PublicGames["games"] | undefined | null,
): FeaturedLobby[] {
  if (!games) return [];

  const used = new Set<string>();
  const filling: PublicGameInfo[] = [];

  for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
    const list = games[type]?.filter(isSpaceLobby);
    if (!list?.length) continue;
    const live = list.find((game) => game.startsAt !== undefined) ?? list[0];
    if (used.has(live.gameID)) continue;
    used.add(live.gameID);
    filling.push(live);
  }

  filling.sort((a, b) => {
    const aAt = a.startsAt;
    const bAt = b.startsAt;
    if (aAt === undefined && bAt === undefined) return 0;
    if (aAt === undefined) return 1;
    if (bAt === undefined) return -1;
    return aAt - bAt;
  });

  const fillingPicks = filling
    .slice(0, FEATURED_FILLING_COUNT)
    .map((lobby) => ({ lobby, upNext: false }));

  const queued: PublicGameInfo[] = [];
  const queues = new Map(
    SCHEDULED_PUBLIC_GAME_TYPES.map((type) => [
      type,
      games[type]?.filter(isSpaceLobby) ?? [],
    ]),
  );
  const maxLen = Math.max(
    0,
    ...[...queues.values()].map((list) => list.length),
  );
  for (let i = 0; i < maxLen && queued.length < FEATURED_UP_NEXT_COUNT; i++) {
    for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
      const game = queues.get(type)?.[i];
      if (game === undefined || used.has(game.gameID)) continue;
      used.add(game.gameID);
      queued.push(game);
      if (queued.length >= FEATURED_UP_NEXT_COUNT) break;
    }
  }

  return [...fillingPicks, ...queued.map((lobby) => ({ lobby, upNext: true }))];
}

@customElement("game-mode-selector")
export class GameModeSelector extends LitElement {
  @state() private lobbies: PublicGames | null = null;
  @state() private inputValid: boolean = true;
  @state() private desktopUpdateState: DesktopUpdateState | null = null;
  @state() private viewerTrusted: boolean = false;
  @state() private viewerSignedIn: boolean = false;
  @state() private showTrustRequired: boolean = false;
  @state() private desktopSessionState: DesktopSessionState | null = null;
  private serverTimeOffset: number = 0;
  private defaultLobbyTime: number = 0;

  private lobbySocket = new PublicLobbySocket((lobbies) =>
    this.handleLobbiesUpdate(lobbies),
  );

  createRenderRoot() {
    return this;
  }

  // Silent backstop; the buttons are already disabled while input is invalid.
  private validateUsername(): boolean {
    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput | null;
    return usernameInput ? usernameInput.canPlay() : true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.lobbySocket.start();
    this.defaultLobbyTime = ClientEnv.gameCreationRate() / 1000;
    window.addEventListener(
      "username-validity-change",
      this.handleValidityChange,
    );
    document.addEventListener(
      "desktop-update-state",
      this.onDesktopUpdateState,
    );
    document.addEventListener("userMeResponse", this.onUserMe);
    if (isDesktopShell()) {
      this.desktopSessionState = getDesktopSessionState();
    }
    document.addEventListener(
      "desktop-session-state",
      this.onDesktopSessionState,
    );
    // Pick up the current value in case username-input validated before us.
    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput | null;
    if (usernameInput) {
      this.inputValid = usernameInput.canPlay();
    }
  }

  disconnectedCallback() {
    this.stop();
    window.removeEventListener(
      "username-validity-change",
      this.handleValidityChange,
    );
    document.removeEventListener(
      "desktop-update-state",
      this.onDesktopUpdateState,
    );
    document.removeEventListener("userMeResponse", this.onUserMe);
    document.removeEventListener(
      "desktop-session-state",
      this.onDesktopSessionState,
    );
    super.disconnectedCallback();
  }

  private handleValidityChange = (e: Event) => {
    this.inputValid = (e as CustomEvent).detail?.isValid ?? true;
  };

  private onDesktopUpdateState = (e: Event) => {
    this.desktopUpdateState = (e as CustomEvent<DesktopUpdateState>).detail;
  };

  private onUserMe = (e: Event) => {
    const me = (e as CustomEvent<UserMeResponse | false>).detail;
    this.viewerSignedIn = viewerIsSignedIn(me);
    this.viewerTrusted = viewerIsTrusted(me);
    // A CrazyGames sign-in surfaces as a userMeResponse without a linked
    // identity, so re-read the SDK profile alongside it.
    if (crazyGamesSDK.isOnCrazyGames()) {
      void crazyGamesSDK.getUserProfile().then((user) => {
        if (user !== null) this.viewerSignedIn = true;
      });
    }
  };

  private onDesktopSessionState = (e: Event) => {
    this.desktopSessionState = (e as CustomEvent<DesktopSessionState>).detail;
  };

  public stop() {
    this.lobbySocket.stop();
  }

  /**
   * Re-open the public-lobby socket after stop().
   *
   * connectedCallback() used to be the only caller of lobbySocket.start(),
   * which was fine while every exit from a started game reloaded the page. It
   * is not fine for an exit that leaves in place (openInvite, OPE-255): this
   * element is never disconnected, so connectedCallback never runs again and
   * the lobby list stayed frozen on whatever it last received.
   *
   * Safe to call when already running -- PublicLobbySocket.start() closes any
   * existing socket before opening a new one -- but callers should still only
   * use it to undo a stop(), since a needless reconnect drops the cached
   * snapshot and re-primes the list from the server.
   */
  public start() {
    this.lobbySocket.start();
  }

  private handleLobbiesUpdate(lobbies: PublicGames) {
    this.lobbies = lobbies;
    this.serverTimeOffset = calculateServerTimeOffset(lobbies.serverTime);
    document.dispatchEvent(
      new CustomEvent("public-lobbies-update", {
        detail: { payload: lobbies },
      }),
    );
    this.requestUpdate();

    const allGames = Object.values(lobbies.games ?? {}).flat();
    for (const game of allGames) {
      mapAspectRatios.ensure(game.gameConfig?.gameMap as GameMapType, () =>
        this.requestUpdate(),
      );
    }
  }

  render() {
    const picks = this.featuredLobbies();

    return html`
      <div
        class="w-full h-full min-h-0 px-4 sm:px-0 mx-auto pb-2 lg:pb-3 flex flex-col lg:flex-row lg:items-stretch lg:justify-between gap-3 lg:gap-6"
      >
        <div
          class="flex flex-col gap-2 sm:gap-3 w-full lg:flex-1 lg:min-w-0 lg:min-h-0 lg:overflow-y-auto"
        >
          <news-box class="block w-full shrink-0"></news-box>

          <div
            class="relative bg-black rounded-xl overflow-hidden flex flex-col gap-2 p-2 sm:p-3 lg:flex-1 lg:min-h-0"
          >
            <cosmetic-background
              class="absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none"
            ></cosmetic-background>
            <div class="relative z-10 flex flex-col gap-2 flex-1 min-h-0">
              <div
                class="flex items-center justify-center px-2 pt-1 pb-1 flex-1 min-h-[10rem] lg:min-h-0"
              >
                <img
                  src=${assetUrl("images/GameLogo.png")}
                  alt="Claiming Cosmos"
                  class="w-auto max-w-full object-contain h-36 sm:h-52 lg:h-full lg:max-h-[17.5rem]"
                />
              </div>
              <div class="rounded-lg bg-black/80 p-1 shrink-0">
                <username-input
                  class="block w-full min-w-0 h-10"
                ></username-input>
              </div>
              <div class="grid grid-cols-2 gap-2 shrink-0">
                <div class="h-11">
                  ${this.renderSmallActionCard(
                    translateText("main.solo"),
                    this.openSinglePlayerModal,
                    SOLO_BTN,
                  )}
                </div>
                <div class="h-11">
                  ${this.renderSmallActionCard(
                    translateText("main.detailed_view"),
                    this.openDetailedView,
                    ACTION_BTN,
                  )}
                </div>
                <div class="h-11">
                  ${this.renderSmallActionCard(
                    translateText("main.create"),
                    this.openHostLobby,
                    ACTION_BTN,
                    undefined,
                    true,
                  )}
                </div>
                <div class="h-11">
                  ${this.renderSmallActionCard(
                    translateText("mode_selector.ranked_title"),
                    this.openRankedMenu,
                    ACTION_BTN,
                    undefined,
                    true,
                    {
                      unavailable: true,
                      subtitle: translateText(
                        "mode_selector.ranked_coming_soon",
                      ),
                    },
                  )}
                </div>
                <div class="col-span-2 h-11">
                  ${this.renderSmallActionCard(
                    translateText("main.join"),
                    this.openJoinLobby,
                    ACTION_BTN,
                    this.hostedLobbyCount(),
                    true,
                  )}
                </div>
              </div>
            </div>
          </div>

          <ios-add-to-home-screen-banner
            class="no-crazygames"
          ></ios-add-to-home-screen-banner>

          <streaming-now
            class="hidden lg:flex lg:flex-col w-full min-w-0 shrink-0 lg:min-h-0"
          ></streaming-now>
        </div>

        <div
          class="w-full min-w-0 shrink-0 flex justify-center lg:justify-end lg:items-start lg:flex-[1.25] lg:w-auto lg:min-h-0 lg:overflow-y-auto"
        >
          ${this.lobbies === null
            ? html`<div
                class="flex items-center justify-center rounded-2xl bg-black/40 w-full aspect-square lg:aspect-auto lg:min-h-64"
              >
                <span
                  class="w-24 h-24 border-[6px] border-white/20 border-t-white rounded-full animate-spin"
                ></span>
              </div>`
            : html`<div
                class="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 w-full"
              >
                ${Array.from({ length: FEATURED_LOBBY_COUNT }, (_, i) => {
                  const pick = picks[i];
                  return html`<div class="min-w-0 aspect-square">
                    ${pick
                      ? this.renderLobbyCard(
                          pick.lobby,
                          this.getLobbyTitle(pick.lobby),
                          pick.upNext,
                        )
                      : html`<div
                          class="h-full w-full rounded-2xl bg-surface/40 border border-white/10"
                        ></div>`}
                  </div>`;
                })}
              </div>`}
        </div>
        ${this.showTrustRequired
          ? trustRequiredDialog(
              this.viewerSignedIn,
              () => (this.showTrustRequired = false),
            )
          : nothing}
      </div>
    `;
  }

  private featuredLobbies(): FeaturedLobby[] {
    return selectFeaturedLobbies(this.lobbies?.games);
  }

  private blockedByUpdate(): boolean {
    if (
      !shouldBlockMultiplayerAction(
        this.desktopUpdateState,
        this.desktopSessionState,
      )
    )
      return false;
    // Optional-call the method rather than dispatching an event: the bar is a
    // sibling custom element that may not have upgraded yet, and `?.wiggle?.()`
    // degrades to a silent no-op in that case instead of firing an event with
    // no listener.
    (
      document.querySelector("desktop-status-bar") as
        | (HTMLElement & { wiggle?: () => void })
        | null
    )?.wiggle?.();
    return true;
  }

  // Ranked matchmaking is not shipped in this fork; the card stays visible.
  private openRankedMenu = () => undefined;

  private openDetailedView = () => {
    if (!this.validateUsername()) return;
    window.showPage?.("page-detailed-view");
  };

  private openSinglePlayerModal = () => {
    if (!this.validateUsername()) return;
    (
      document.querySelector("single-player-modal") as SinglePlayerModal
    )?.open();
  };

  private openHostLobby = () => {
    if (this.blockedByUpdate()) return;
    if (!this.validateUsername()) return;
    (document.querySelector("host-lobby-modal") as HostLobbyModal)?.open();
  };

  private openJoinLobby = () => {
    if (this.blockedByUpdate()) return;
    if (!this.validateUsername()) return;
    (document.querySelector("join-lobby-modal") as JoinLobbyModal)?.open();
  };

  // Number of open hosted lobbies waiting in the browser; shown as a chip
  // on the Join button.
  private hostedLobbyCount(): number {
    return this.lobbies?.games?.hosted?.length ?? 0;
  }

  private renderSmallActionCard(
    title: string,
    onClick: () => void,
    bgClass: string = CARD_BG,
    badge?: number,
    // Only the three multiplayer action cards (create/ranked/join) pass this;
    // the solo card is never gated (see openSinglePlayerModal) and must never
    // show as disabled here.
    gated: boolean = false,
    extras: { unavailable?: boolean; subtitle?: string } = {},
  ) {
    const blocked =
      gated &&
      shouldBlockMultiplayerAction(
        this.desktopUpdateState,
        this.desktopSessionState,
      );
    const unavailable = extras.unavailable === true;
    const disabled = !this.inputValid || unavailable;
    const labelColor =
      bgClass.includes("text-white") || bgClass.includes("text-black")
        ? ""
        : "text-white";
    return html`
      <button
        @click=${unavailable ? undefined : onClick}
        ?disabled=${disabled}
        aria-disabled=${blocked || unavailable}
        class="relative flex items-center justify-center w-full h-full rounded-lg font-button ${bgClass} ${labelColor} transition-all duration-200 text-sm lg:text-base font-medium uppercase tracking-wider text-center ${disabled
          ? "opacity-50 cursor-not-allowed pointer-events-none"
          : blocked
            ? "opacity-50 cursor-not-allowed"
            : ""}"
        style="color: white"
      >
        <span class="flex flex-col items-center justify-center leading-tight">
          <span>${title}</span>
          ${extras.subtitle
            ? html`<span
                class="normal-case tracking-normal text-[10px] lg:text-xs font-normal opacity-80"
                >${extras.subtitle}</span
              >`
            : nothing}
        </span>
        ${badge
          ? html`<span
              class="absolute -top-2 -right-2 min-w-[1.375rem] h-[1.375rem] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold tracking-normal"
              >${badge}</span
            >`
          : nothing}
      </button>
    `;
  }

  private renderLobbyCard(
    lobby: PublicGameInfo,
    titleContent: string | TemplateResult,
    upNext = false,
  ) {
    const timeRemaining = lobby.startsAt
      ? getSecondsUntilServerTimestamp(lobby.startsAt, this.serverTimeOffset)
      : undefined;

    let timeDisplay: string;
    let timeDisplayUppercase = false;
    if (timeRemaining === undefined) {
      // Queued games have no countdown yet; the "Up next" pill is the label.
      // Filling cards without startsAt keep the default duration placeholder.
      timeDisplay = upNext ? "" : renderDuration(this.defaultLobbyTime);
    } else if (timeRemaining > 0) {
      timeDisplay = renderDuration(timeRemaining);
    } else {
      timeDisplay = translateText("public_lobby.starting_game");
      timeDisplayUppercase = true;
    }

    // Gated, not disabled: `disabled` (which the option below sets, together
    // with pointer-events-none) swallows the click, and the click is what
    // makes the update bar wiggle. `blocked` only dims and reports
    // aria-disabled; validateAndJoin does the refusing.
    return lobbyCard({
      lobby,
      subtitle: titleContent,
      timeDisplay,
      timeDisplayUppercase,
      upNext,
      disabled: !this.inputValid,
      blocked: shouldBlockMultiplayerAction(
        this.desktopUpdateState,
        this.desktopSessionState,
      ),
      viewerTrusted: this.viewerTrusted,
      heightClass: "h-full w-full",
      onClick: () => this.validateAndJoin(lobby),
    });
  }

  private validateAndJoin(lobby: PublicGameInfo) {
    if (this.blockedByUpdate()) return;
    if (!this.validateUsername()) return;
    if (!canJoinTrustedLobby(lobby, this.viewerTrusted)) {
      this.showTrustRequired = true;
      return;
    }

    this.dispatchEvent(
      new CustomEvent("join-lobby", {
        detail: {
          gameID: lobby.gameID,
          source: "public",
          publicLobbyInfo: lobby,
        } as JoinLobbyEvent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getLobbyTitle(lobby: PublicGameInfo): string {
    const config = lobby.gameConfig!;
    if (config.gameMode === GameMode.FFA) {
      return translateText("game_mode.ffa");
    }

    if (config?.gameMode === GameMode.Team) {
      const totalPlayers = config.maxPlayers ?? lobby.numClients ?? undefined;
      const formatTeamsOf = (
        teamCount: number | undefined,
        playersPerTeam: number | undefined,
        label?: string,
      ) => {
        if (!teamCount)
          return label ?? translateText("mode_selector.teams_title");
        const baseTitle = playersPerTeam
          ? translateText("mode_selector.teams_of", {
              teamCount: String(teamCount),
              playersPerTeam: String(playersPerTeam),
            })
          : translateText("mode_selector.teams_count", {
              teamCount: String(teamCount),
            });
        return `${baseTitle}${label ? ` (${label})` : ""}`;
      };

      switch (config.playerTeams) {
        case Duos: {
          const teamCount = totalPlayers
            ? Math.floor(totalPlayers / 2)
            : undefined;
          return formatTeamsOf(teamCount, 2);
        }
        case Trios: {
          const teamCount = totalPlayers
            ? Math.floor(totalPlayers / 3)
            : undefined;
          return formatTeamsOf(teamCount, 3);
        }
        case Quads: {
          const teamCount = totalPlayers
            ? Math.floor(totalPlayers / 4)
            : undefined;
          return formatTeamsOf(teamCount, 4);
        }
        case HumansVsNations: {
          const humanSlots = config.maxPlayers ?? lobby.numClients;
          return humanSlots
            ? translateText("public_lobby.teams_hvn_detailed", {
                num: String(humanSlots),
              })
            : translateText("public_lobby.teams_hvn");
        }
        default:
          if (typeof config.playerTeams === "number") {
            const teamCount = config.playerTeams;
            const playersPerTeam =
              totalPlayers && teamCount > 0
                ? Math.floor(totalPlayers / teamCount)
                : undefined;
            return formatTeamsOf(teamCount, playersPerTeam);
          }
      }
    }

    return "";
  }
}
