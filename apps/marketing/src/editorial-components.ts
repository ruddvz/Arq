import { html, type SafeHtml } from './html.js';

export interface EditorialAction {
  readonly href: string;
  readonly label: string;
}

export interface TechnicalFact {
  readonly term: string;
  readonly value: string;
}

export interface EditorialHeroOptions {
  readonly eyebrow: string;
  readonly heading: readonly string[];
  readonly lede: string;
  readonly actions?: readonly EditorialAction[];
  readonly facts?: readonly TechnicalFact[];
  readonly diagramLabel?: string;
}

function editorialActions(actions: readonly EditorialAction[] | undefined): SafeHtml {
  if (actions === undefined || actions.length === 0) return html``;
  return html`<p class="editorial-actions">
    ${actions.map(
      (action, index) =>
        html`<a
          class="${index === 0 ? 'editorial-link editorial-link--primary' : 'editorial-link'}"
          href="${action.href}"
          >${action.label}</a
        >`,
    )}
  </p>`;
}

export function technicalRail(label: string, facts: readonly TechnicalFact[]): SafeHtml {
  return html`
    <aside class="technical-rail" aria-label="${label}">
      <p class="technical-rail__label">${label}</p>
      <dl class="technical-rail__list">
        ${facts.map(
          (fact) => html`
            <div class="technical-rail__row">
              <dt>${fact.term}</dt>
              <dd>${fact.value}</dd>
            </div>
          `,
        )}
      </dl>
    </aside>
  `;
}

export function editorialHero(options: EditorialHeroOptions): SafeHtml {
  const facts =
    options.facts === undefined || options.facts.length === 0
      ? html``
      : technicalRail('Current build', options.facts);
  const diagramLabel = options.diagramLabel ?? 'Semantic plan geometry';
  return html`
    <section class="editorial-hero">
      <div class="editorial-frame editorial-hero__grid">
        <p class="editorial-kicker">${options.eyebrow}</p>
        <h1 class="editorial-display">
          ${options.heading.map((line) => html`<span>${line}</span>`)}
        </h1>
        <p class="editorial-lede">${options.lede}</p>
        ${editorialActions(options.actions)} ${facts}
        <div class="plan-figure" aria-hidden="true">
          <span class="plan-figure__label">${diagramLabel}</span>
          <span class="plan-figure__wall plan-figure__wall--a"></span>
          <span class="plan-figure__wall plan-figure__wall--b"></span>
          <span class="plan-figure__wall plan-figure__wall--c"></span>
          <span class="plan-figure__wall plan-figure__wall--d"></span>
          <span class="plan-figure__datum plan-figure__datum--x"></span>
          <span class="plan-figure__datum plan-figure__datum--y"></span>
        </div>
      </div>
    </section>
  `;
}

export function editorialStatement(
  index: string,
  heading: readonly string[],
  body: SafeHtml,
): SafeHtml {
  return html`
    <section class="editorial-statement">
      <div class="editorial-frame editorial-statement__grid">
        <p class="editorial-index" aria-hidden="true">${index}/</p>
        <h2 class="editorial-statement__heading">
          ${heading.map((line) => html`<span>${line}</span>`)}
        </h2>
        <div class="editorial-prose">${body}</div>
      </div>
    </section>
  `;
}

export interface StatePairItem {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export function statePair(
  index: string,
  heading: string,
  items: readonly [StatePairItem, StatePairItem],
  body?: SafeHtml,
): SafeHtml {
  return html`
    <section class="state-pair-section">
      <div class="editorial-frame">
        <p class="editorial-index" aria-hidden="true">${index}/</p>
        <h2 class="state-pair-section__heading">${heading}</h2>
        <dl class="state-pair">
          ${items.map(
            (item) => html`
              <div class="state-pair__item">
                <dt>${item.label}</dt>
                <dd class="state-pair__value">${item.value}</dd>
                <dd class="state-pair__detail">${item.detail}</dd>
              </div>
            `,
          )}
        </dl>
        ${body === undefined ? html`` : html`<div class="state-pair-section__body">${body}</div>`}
      </div>
    </section>
  `;
}

export function routeCta(
  index: string,
  heading: string,
  body: string,
  links: readonly EditorialAction[],
): SafeHtml {
  return html`
    <section class="route-cta">
      <div class="editorial-frame route-cta__grid">
        <p class="editorial-index" aria-hidden="true">${index}/</p>
        <div class="route-cta__copy">
          <h2>${heading}</h2>
          <p>${body}</p>
        </div>
        <div class="route-cta__links">
          ${links.map(
            (link, index) => html`
              <a
                class="${index === 0 ? 'route-link route-link--primary' : 'route-link'}"
                href="${link.href}"
              >
                <span>${link.label}</span><span aria-hidden="true">→</span>
              </a>
            `,
          )}
        </div>
      </div>
    </section>
  `;
}
