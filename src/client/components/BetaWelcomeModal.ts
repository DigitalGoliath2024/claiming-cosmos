import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { CONTACT_FORM_URL } from "../Attribution";
import { translateText } from "../Utils";

/** Bump to re-show the welcome after major beta message changes. */
export const BETA_WELCOME_VERSION = "1";
export const BETA_WELCOME_STORAGE_KEY = "claimingCosmosBetaWelcome";

/**
 * First-visit Early Beta welcome on the home page. Shown until the player
 * dismisses it; dismissal is persisted in localStorage.
 */
@customElement("beta-welcome-modal")
export class BetaWelcomeModal extends LitElement {
  @state() private isVisible = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      if (localStorage.getItem(BETA_WELCOME_STORAGE_KEY) === BETA_WELCOME_VERSION) {
        return;
      }
    } catch {
      // localStorage unavailable — still show for this session
    }
    this.isVisible = true;
  }

  private dismiss() {
    try {
      localStorage.setItem(BETA_WELCOME_STORAGE_KEY, BETA_WELCOME_VERSION);
    } catch {
      // session-only dismiss
    }
    this.isVisible = false;
  }

  render() {
    if (!this.isVisible) return nothing;

    return html`
      <div
        class="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div
          class="bg-slate-900 text-white rounded-xl shadow-2xl border border-white/10 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="beta-welcome-title"
        >
          <div class="flex items-start justify-between gap-4 mb-4">
            <h2
              id="beta-welcome-title"
              class="text-2xl sm:text-3xl font-bold tracking-wide text-sky-100"
            >
              ${translateText("beta_welcome.title")}
            </h2>
            <button
              type="button"
              class="shrink-0 text-white/60 hover:text-white text-2xl leading-none cursor-pointer"
              aria-label=${translateText("beta_welcome.close")}
              @click=${this.dismiss}
            >
              ✕
            </button>
          </div>

          <div class="space-y-4 text-sm sm:text-base text-slate-200 leading-relaxed">
            <p class="text-sky-200/90 font-medium">
              ${translateText("beta_welcome.lede")}
            </p>
            <p>${translateText("beta_welcome.beta")}</p>
            <p>${translateText("beta_welcome.origin")}</p>
            <p>${translateText("beta_welcome.cta_body")}</p>
            <p>
              ${translateText("beta_welcome.bug_prefix")}
              <a
                class="text-sky-300 underline underline-offset-2 hover:text-sky-200"
                href=${CONTACT_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                >${translateText("beta_welcome.contact_form")}</a
              >${translateText("beta_welcome.bug_suffix")}
            </p>
            <p class="text-sky-100 font-medium pt-1">
              ${translateText("beta_welcome.closing")}
            </p>
          </div>

          <div class="flex justify-end mt-6">
            <button
              type="button"
              class="cursor-pointer rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold px-5 py-2.5 transition-colors"
              @click=${this.dismiss}
            >
              ${translateText("beta_welcome.enter")}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
