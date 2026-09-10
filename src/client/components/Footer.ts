import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import version from "resources/version.txt?raw";
import { assetUrl } from "../../core/AssetUrls";
import {
  AGPL_LICENSE_URL,
  ASSET_CREDITS_URL,
  FLYING_V_STUDIOS_URL,
  OPENFRONT_IO_URL,
  SOURCE_REPO_URL,
} from "../Attribution";
import { composeVersionDisplay, desktopVersion } from "../DesktopShell";

const gameVersion = (() => {
  const trimmed = version.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
})();

const linkClass = "hover:text-white transition-colors whitespace-nowrap";

@customElement("page-footer")
export class Footer extends LitElement {
  @state() private versionLabel = gameVersion;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void desktopVersion().then((shellVersion) => {
      this.versionLabel = composeVersionDisplay(gameVersion, shellVersion);
    });
  }

  render() {
    return html`
      <footer
        class="[.in-game_&]:hidden bg-black flex items-center justify-between gap-2 px-2 lg:px-4 py-1.5 text-[10px] lg:text-[11px] leading-none text-white/50 w-full border-t border-white/10 shrink-0 relative z-50 min-h-0"
      >
        <img
          src=${assetUrl("images/GameLogo.png")}
          alt="Claiming Cosmos"
          class="h-10 lg:h-[50px] w-auto max-w-[28%] object-contain shrink-0"
        />

        <div
          class="flex flex-nowrap items-center justify-end gap-x-2.5 gap-y-1 min-w-0 overflow-x-auto"
        >
          <a
            href=${SOURCE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="opacity-70 hover:opacity-100 hover:scale-110 transition-all shrink-0"
          >
            <img
              src=${assetUrl("icons/github-mark-white.svg")}
              data-i18n-alt="main.github"
              class="h-4 w-4 object-contain pointer-events-none"
              draggable="false"
            />
          </a>
          <span class="footer-version whitespace-nowrap tabular-nums text-white/80"
            >${this.versionLabel}</span
          >
          <span class="hidden lg:inline text-right min-w-0" data-attribution>
            <span data-i18n="main.footer_product_prefix"></span><a
              href=${FLYING_V_STUDIOS_URL}
              data-i18n="main.studio_name"
              target="_blank"
              rel="noopener noreferrer"
              class=${linkClass}
            ></a>.
            <span data-i18n="main.modification_notice"></span><a
              href=${OPENFRONT_IO_URL}
              data-i18n="main.openfront_site"
              target="_blank"
              rel="noopener noreferrer"
              class=${linkClass}
            ></a>.
            <span data-i18n="main.copyright"></span>.
            <span data-i18n="main.not_affiliated"></span>
          </span>
          <a
            href=${SOURCE_REPO_URL}
            data-i18n="main.source_code"
            target="_blank"
            rel="noopener noreferrer"
            class=${linkClass}
          ></a>
          <a
            href=${AGPL_LICENSE_URL}
            data-i18n="main.agpl_license"
            target="_blank"
            rel="noopener noreferrer"
            class=${linkClass}
          ></a>
          <a
            href=${ASSET_CREDITS_URL}
            data-i18n="main.asset_credits"
            target="_blank"
            rel="noopener noreferrer"
            class=${linkClass}
          ></a>
          <a href="/wiki/" data-i18n="main.wiki" class=${linkClass}></a>
          <a
            href="/terms-of-service.html"
            data-i18n="main.terms_of_service"
            target="_blank"
            class=${linkClass}
          ></a>
          <a
            href="/privacy-policy.html"
            data-i18n="main.privacy_policy"
            target="_blank"
            class=${linkClass}
          ></a>
          <lang-selector
            class="shrink-0 [&_button]:!w-7 [&_button]:!h-7 [&_img]:!w-6 [&_img]:!h-6 lg:[&_button]:!w-7 lg:[&_button]:!h-7 lg:[&_img]:!w-6 lg:[&_img]:!h-6"
          ></lang-selector>
        </div>
      </footer>
    `;
  }
}
