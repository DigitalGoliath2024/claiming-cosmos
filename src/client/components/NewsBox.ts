import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { NewsItem } from "../../core/ApiSchemas";
import { getNews } from "../Api";
import { renderMarkdown } from "../Markdown";
import { translateText } from "../Utils";

export type { NewsItem };

const DISMISSED_NEWS_KEY = "dismissedNewsItems";
const CYCLE_INTERVAL_MS = 5000;

function getDismissedIds(): Set<string> {
  const raw = localStorage.getItem(DISMISSED_NEWS_KEY);
  if (raw) return new Set(JSON.parse(raw));
  return new Set();
}

function saveDismissedIds(ids: Set<string>): void {
  localStorage.setItem(DISMISSED_NEWS_KEY, JSON.stringify([...ids]));
}

export function getVisibleNewsItems(items: NewsItem[]): NewsItem[] {
  const dismissed = getDismissedIds();
  return items.filter((item) => !dismissed.has(item.id));
}

const typeLabelKeys: Record<string, string> = {
  tournament: "news_box.tournament",
  tutorial: "news_box.tutorial",
  announcement: "news_box.news",
  warning: "news_box.warning",
};

const typeLabelColors: Record<string, string> = {
  tournament: "bg-white/10 text-white",
  tutorial: "bg-white/10 text-white",
  announcement: "bg-white/10 text-white",
  warning: "bg-white/15 text-white",
};

@customElement("news-box")
export class NewsBox extends LitElement {
  @state() private items: NewsItem[] = [];
  @state() private activeIndex = 0;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadNews();
  }

  private async loadNews() {
    try {
      const allItems = await getNews();
      // Reset stale dismissed list when all items would be hidden
      const visible = getVisibleNewsItems(allItems);
      if (visible.length === 0 && allItems.length > 0) {
        localStorage.removeItem(DISMISSED_NEWS_KEY);
        this.items = allItems;
      } else {
        this.items = visible;
      }
      this.startCycle();
    } catch (e) {
      console.error(e);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopCycle();
  }

  private startCycle() {
    this.stopCycle();
    if (this.items.length > 1) {
      this.cycleTimer = setInterval(() => {
        this.activeIndex = (this.activeIndex + 1) % this.items.length;
      }, CYCLE_INTERVAL_MS);
    }
  }

  private stopCycle() {
    if (this.cycleTimer !== null) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  private dismiss(id: string) {
    const dismissed = getDismissedIds();
    dismissed.add(id);
    saveDismissedIds(dismissed);
    this.items = this.items.filter((item) => item.id !== id);
    if (this.activeIndex >= this.items.length) {
      this.activeIndex = 0;
    }
    this.startCycle();
  }

  private goTo(index: number) {
    this.activeIndex = index;
    this.startCycle();
  }

  render() {
    const item = this.items[this.activeIndex];

    return html`
      <div
        class="px-3 py-1.5 sm:py-2 bg-surface border-y border-white/10 lg:border-y-0 lg:rounded-xl w-full min-h-0 overflow-hidden flex flex-col gap-0.5 sm:gap-1"
      >
        <p
          class="hidden sm:block shrink-0 text-sm sm:text-base font-display font-bold leading-snug text-gold"
          data-news-welcome
        >
          ${translateText("news_box.welcome")}
          <span class="text-malibu-blue"
            >${translateText("news_box.welcome_strategy")}</span
          >
        </p>
        ${item
          ? html`
              <div class="flex items-start gap-3 w-full min-h-0">
                <span
                  class="shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${typeLabelColors[
                    item.type
                  ] ?? typeLabelColors["announcement"]}"
                  >${translateText(
                    typeLabelKeys[item.type] ?? typeLabelKeys["announcement"],
                  )}</span
                >
                <div class="flex-1 min-w-0">
                  ${item.url
                    ? html`<a
                        href="${item.url}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm font-medium text-white hover:text-white/70 transition-colors line-clamp-1 sm:line-clamp-2 block"
                        >${item.title}</a
                      >`
                    : html`<span
                        class="text-sm font-medium text-white line-clamp-1 sm:line-clamp-2 block"
                        >${item.title}</span
                      >`}
                  <span
                    class="text-xs text-white/70 block line-clamp-1 sm:line-clamp-2 lg:line-clamp-3 [&_a]:text-white [&_a:hover]:underline"
                    >${renderMarkdown(
                      item.descriptionTranslationKey
                        ? translateText(item.descriptionTranslationKey)
                        : (item.description ?? ""),
                    )}</span
                  >
                </div>
                ${this.items.length > 1
                  ? html`
                      <div class="flex gap-1 shrink-0">
                        ${this.items.map(
                          (_, i) => html`
                            <button
                              @click=${() => this.goTo(i)}
                              class="w-1.5 h-1.5 rounded-full transition-colors ${i ===
                              this.activeIndex
                                ? "bg-white/60"
                                : "bg-white/20 hover:bg-white/40"}"
                              aria-label="${translateText(
                                "news_box.go_to_item",
                                {
                                  num: i + 1,
                                },
                              )}"
                            ></button>
                          `,
                        )}
                      </div>
                    `
                  : nothing}
                <button
                  @click=${() => this.dismiss(item.id)}
                  class="shrink-0 p-0.5 text-white/30 hover:text-white/70 transition-colors"
                  aria-label="${translateText("news_box.dismiss")}"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="w-3.5 h-3.5"
                  >
                    <path
                      d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                    />
                  </svg>
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
