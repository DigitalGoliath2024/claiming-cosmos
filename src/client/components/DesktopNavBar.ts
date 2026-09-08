import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { NavNotificationsController } from "./NavNotificationsController";
import "./NavUtilityIcons";

/** Flip to show Store / Inventory / Leaderboard / Clans in homepage chrome. */
const SHOW_STORE_INVENTORY_LEADERBOARD_CLANS = false;

@customElement("desktop-nav-bar")
export class DesktopNavBar extends LitElement {
  private _notifications = new NavNotificationsController(this);

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("showPage", this._onShowPage);

    const current = window.currentPageId;
    if (current) {
      // Wait for render
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
      if ((el as HTMLElement).dataset.page === pageId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;

    return html`
      <nav
        class="hidden lg:grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center bg-black py-4 px-4 min-h-[7rem] shrink-0 z-50 relative"
      >
        <div aria-hidden="true"></div>
        <button
          type="button"
          class="nav-menu-item justify-self-center cursor-pointer bg-transparent border-0 p-0"
          data-page="page-play"
          data-i18n-aria-label="main.title"
          data-i18n-title="main.title"
        >
          <img
            class="block h-20 w-auto max-w-[260px] object-contain"
            src=${assetUrl("images/GameLogo.jpg")}
            alt="Claiming Cosmos"
          />
        </button>
        <div class="min-w-0 flex items-center justify-end gap-4">
          ${SHOW_STORE_INVENTORY_LEADERBOARD_CLANS
            ? html`
                <div class="relative no-crazygames">
                  <button
                    class="nav-menu-item ${currentPage === "page-item-store"
                      ? "active"
                      : ""} text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
                    data-page="page-item-store"
                    data-i18n="main.store"
                    @click=${this._notifications.onStoreClick}
                  ></button>
                  ${this._notifications.showStoreDot()
                    ? html`
                        <span
                          class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"
                        ></span>
                        <span
                          class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
                        ></span>
                      `
                    : ""}
                </div>
                <button
                  class="nav-menu-item ${currentPage === "page-inventory"
                    ? "active"
                    : ""} text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
                  data-page="page-inventory"
                  data-i18n="main.inventory"
                ></button>
                <button
                  class="nav-menu-item font-button text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
                  data-page="page-leaderboard"
                  data-i18n="main.leaderboard"
                ></button>
                <button
                  class="no-crazygames nav-menu-item text-white/70 hover:text-malibu-blue font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue"
                  data-page="page-clan"
                  data-i18n="main.clans"
                ></button>
              `
            : nothing}
          <nav-utility-icons size="desktop"></nav-utility-icons>
        </div>
      </nav>
    `;
  }
}
