import { html, type SafeHtml } from './html.js';

/**
 * The set's shared drawing conventions.
 *
 * Pages are composed like sheets: a hero band on grid paper, then numbered
 * notes ("01", "02", …) the way a drawing carries general notes. The numbering is
 * generated, so a page can never skip or repeat a note number.
 */

export interface HeroOptions {
  /**
   * Optional mono line above the h1. Used sparingly - the home page's
   * identity line and the 404's status line. Sheet numbers live in the
   * footer title block, their one home; repeating them here read as
   * breadcrumb clutter and was removed.
   */
  readonly eyebrow?: string;
  /** The page's single h1. */
  readonly heading: string;
  /** One or two sentences under the heading. */
  readonly lede: string;
  /** Optional call-to-action links: first renders solid, rest outlined. */
  readonly actions?: readonly { readonly href: string; readonly label: string }[];
}

export function hero(options: HeroOptions): SafeHtml {
  const actions =
    options.actions === undefined || options.actions.length === 0
      ? html``
      : html`<p class="hero-actions">
          ${options.actions.map(
            (action, index) =>
              html`<a
                class="${index === 0 ? 'button-solid' : 'button-outline'}"
                href="${action.href}"
                >${action.label}</a
              >`,
          )}
        </p>`;
  const eyebrow =
    options.eyebrow === undefined ? html`` : html`<p class="eyebrow">${options.eyebrow}</p>`;
  return html`
    <section class="hero">
      <div class="measure">
        ${eyebrow}
        <h1>${options.heading}</h1>
        <p class="lede">${options.lede}</p>
        ${actions}
      </div>
    </section>
  `;
}

export interface Note {
  readonly title: string;
  readonly body: SafeHtml;
  /**
   * Marks this note as a limitation or caution rather than an ordinary
   * narrative note: it gets a "LIMIT" marker instead of a sequence number
   * and a rule down its left edge, so a warning cannot be mistaken for a
   * feature description at a glance. Does not consume a sequence number,
   * so the numbered notes around it stay contiguous (01, 02, 03 …).
   */
  readonly kind?: 'limit';
}

/** Numbered general notes: 01, 02, 03 … generated from array order. */
export function notes(entries: readonly Note[]): SafeHtml {
  let sequence = 0;
  return html`
    <div class="measure">
      ${entries.map((entry) => {
        const isLimit = entry.kind === 'limit';
        const marker = isLimit ? 'LIMIT' : String((sequence += 1)).padStart(2, '0');
        return html`
          <section class="${isLimit ? 'note note--limit' : 'note'}">
            <h2>
              <span class="note-number" aria-hidden="true">${marker}</span>
              ${entry.title}
            </h2>
            <div class="note-body">${entry.body}</div>
          </section>
        `;
      })}
    </div>
  `;
}

/** A definition-style list of term/description rows, used for scope lists. */
export function specList(
  rows: readonly { readonly term: string; readonly detail: string }[],
): SafeHtml {
  return html`
    <dl class="spec-list">
      ${rows.map(
        (row) => html`
          <div class="spec-row">
            <dt>${row.term}</dt>
            <dd>${row.detail}</dd>
          </div>
        `,
      )}
    </dl>
  `;
}

/** Data table with mono cells - used for the format support matrix. */
export function dataTable(
  caption: string,
  head: readonly string[],
  rows: readonly (readonly string[])[],
): SafeHtml {
  return html`
    <div class="table-scroll">
      <table class="data-table">
        <caption>
          ${caption}
        </caption>
        <thead>
          <tr>
            ${head.map((cell) => html`<th scope="col">${cell}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            (row) => html`
              <tr>
                ${row.map((cell, index) =>
                  index === 0 ? html`<th scope="row">${cell}</th>` : html`<td>${cell}</td>`,
                )}
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}

/** Closing band that routes onward - every sheet ends somewhere useful. */
export function ctaBand(
  heading: string,
  body: string,
  links: readonly { readonly href: string; readonly label: string }[],
): SafeHtml {
  return html`
    <section class="cta-band">
      <div class="measure">
        <h2>${heading}</h2>
        <p>${body}</p>
        <p class="hero-actions">
          ${links.map(
            (link, index) =>
              html`<a class="${index === 0 ? 'button-solid' : 'button-outline'}" href="${link.href}"
                >${link.label}</a
              >`,
          )}
        </p>
      </div>
    </section>
  `;
}

/** Plain-language status chip: built, in development, planned, not committed. */
export function statusChip(
  state: 'built' | 'in-development' | 'planned' | 'not-committed',
): SafeHtml {
  const labels: Record<typeof state, string> = {
    built: 'Built',
    'in-development': 'In development',
    planned: 'Planned',
    'not-committed': 'Not committed',
  };
  return html`<span class="status-chip status-${state}">${labels[state]}</span>`;
}
