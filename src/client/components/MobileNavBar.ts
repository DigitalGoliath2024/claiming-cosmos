import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { NavNotificationsController } from "./NavNotificationsController";

/** Flip to show Store / Inventory / Leaderboard / Clans in homepage chrome. */
const SHOW_STORE_INVENTORY_LEADERBOARD_CLANS = false;

const MOBILE_ITEM =
  "nav-menu-item font-button block w-full text-left font-bold uppercase tracking-[0.05em] " +
  "text-white/70 transition-all duration-200 cursor-pointer " +
  "hover:text-malibu-blue hover:translate-x-2.5 " +
  "hover:drop-shadow-[0_0_20px_rgba(220,154,32,0.5)] " +
  "[&.active]:text-malibu-blue [&.active]:translate-x-2.5 " +
  "[&.active]:drop-shadow-[0_0_20px_rgba(231,165,40,0.5)] " +
  "text-[clamp(18px,2.8vh,32px)] py-[clamp(0.2rem,0.8vh,0.75rem)]";

@customElement("mobile-nav-bar")
export class MobileNavBar extends LitElement {
  private _notifications = new NavNotificationsController(this);

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("showPage", this._onShowPage);

    const current = window.currentPageId;
    if (current) {
      this.updateComplete.then(() => {
        this._updateActiveState(current);
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("showPage", this._onShowPage);
  }

  private _onShowPage = (e: Event) => {
    const pageId = (e as CustomEvent).detail;
    this._updateActiveState(pageId);
  };

  private _updateActiveState(pageId: string) {
    this.querySelectorAll(".nav-menu-item").forEach((el) => {
      const inner = el.querySelector("button");
      if ((el as HTMLElement).dataset.page === pageId) {
        el.classList.add("active");
        inner?.classList.add("active");
      } else {
        el.classList.remove("active");
        inner?.classList.remove("active");
      }
    });
  }

  private _renderDot(color: string): TemplateResult {
    return html`<span class="relative ml-2 shrink-0 -mt-2 w-2 h-2">
      <span class="absolute inset-0 ${color} rounded-full animate-ping"></span>
      <span class="absolute inset-0 ${color} rounded-full"></span>
    </span>`;
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;

    return html`
      <!-- Border Segments (Custom right border with gap for button) -->
      <div
        class="absolute right-0 top-0 w-px bg-transparent"
        style="height: calc(50% - 64px)"
      ></div>
      <div
        class="absolute right-0 bottom-0 w-px bg-transparent"
        style="height: calc(50% - 64px)"
      ></div>

      <div
        class="flex-1 w-full flex flex-col justify-start overflow-y-auto lg:pt-[clamp(1rem,3vh,4rem)] lg:pb-[clamp(0.5rem,2vh,2rem)] lg:px-[clamp(1rem,1.5vw,2rem)] pt-4 pb-4 px-5 gap-4 lg:gap-[clamp(1rem,3vh,3rem)]"
      >
        <!-- Logo + Menu -->
        <div
          class="flex flex-col text-malibu-blue mb-4 ml-[clamp(0.2rem,0.4vw,0.4vh)]"
        >
          <div class="flex flex-col items-center">
            <button
              type="button"
              class="nav-menu-item cursor-pointer bg-transparent border-0 p-0"
              data-page="page-play"
              data-i18n-aria-label="main.title"
              data-i18n-title="main.title"
            >
              <img
                src=${assetUrl("images/GameLogo.jpg")}
                alt="Claiming Cosmos"
                class="w-auto h-auto max-w-[220px] max-h-[5.5rem] object-contain"
              />
            </button>
          </div>
        </div>
        <!-- Mobile Navigation Menu Items (same order as the desktop bar) -->
        <button
          class="${MOBILE_ITEM} ${currentPage === "page-guide" ? "active" : ""}"
          data-page="page-guide"
          data-i18n="main.guide"
        ></button>
        <button
          class="${MOBILE_ITEM} ${currentPage === "page-help" ? "active" : ""}"
          data-page="page-help"
          data-i18n="main.help"
          @click=${this._notifications.onHelpClick}
        ></button>
        <button
          class="${MOBILE_ITEM} ${currentPage === "page-news" ? "active" : ""}"
          data-page="page-news"
          data-i18n="main.news"
          @click=${this._notifications.onNewsClick}
        ></button>
        <button
          class="${MOBILE_ITEM} ${currentPage === "page-settings"
            ? "active"
            : ""}"
          data-page="page-settings"
          data-i18n="nav_account_menu.game_settings"
        ></button>
        ${SHOW_STORE_INVENTORY_LEADERBOARD_CLANS
          ? html`
              <div
                class="no-crazygames nav-menu-item flex items-center w-full cursor-pointer"
                data-page="page-item-store"
                @click=${this._notifications.onStoreClick}
              >
                <button
                  class="${MOBILE_ITEM}"
                  data-i18n="main.store"
                ></button>
                ${this._notifications.showStoreDot()
                  ? this._renderDot("bg-red-500")
                  : ""}
              </div>
              <button
                class="${MOBILE_ITEM} ${currentPage === "page-inventory"
                  ? "active"
                  : ""}"
                data-page="page-inventory"
                data-i18n="main.inventory"
              ></button>
              <button
                class="${MOBILE_ITEM}"
                data-page="page-leaderboard"
                data-i18n="main.leaderboard"
              ></button>
              <button
                class="no-crazygames ${MOBILE_ITEM}"
                data-page="page-clan"
                data-i18n="main.clans"
              ></button>
            `
          : nothing}
        <div
          class="flex flex-col w-full mt-auto [.in-game_&]:hidden items-end justify-end pt-4 border-t border-white/10"
        ></div>
      </div>
    `;
  }
}
