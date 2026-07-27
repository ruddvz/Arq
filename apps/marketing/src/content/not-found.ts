import { hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * The set's not-found sheet, written to the product's own error rules:
 * what happened, why, what was affected, what remains safe, what you can do.
 * Served as /404.html by static hosts.
 */
export const notFoundPage: Page = {
  meta: {
    id: 'PUB-404',
    route: '/404',
    title: 'Sheet not found',
    documentTitle: 'Sheet not found — Arq',
    description: 'This page is not in the set. Nothing was lost; the index below routes onward.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'HTTP 404 · not found',
      heading: 'This sheet is not in the set.',
      lede: 'The address you followed does not match any page on this site. The link may be old, or mistyped — nothing on your side was lost or changed.',
    })}
    ${notes([
      {
        title: 'What you can do',
        body: html`
          <ul>
            <li><a href="/">Go to the home page</a></li>
            <li><a href="/product">Read the product overview</a></li>
            <li><a href="/docs">Browse the documentation index</a></li>
            <li>
              If a link on this site brought you here, that is a defect —
              <a href="/contact">report it</a> and it will be fixed.
            </li>
          </ul>
        `,
      },
    ])}
  `,
};
