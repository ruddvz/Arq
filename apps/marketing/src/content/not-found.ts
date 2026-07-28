import { hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * The set's not-found sheet, written to the product's own error rules: what
 * happened, why, what was affected, what remains safe, what you can do. Served
 * as /404.html by static hosts.
 *
 * Classified non-claim in docs/product/voice/public-copy-inventory.json: it
 * carries no product claim and must not acquire one. Keep it generic.
 */
export const notFoundPage: Page = {
  meta: {
    id: 'PUB-404',
    route: '/404',
    title: 'Page not found',
    documentTitle: 'Page not found · Arq',
    description:
      'This address does not match a page on this site. Nothing on your side was changed, and the links below route onward to the rest of the site.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'HTTP 404 · not found',
      heading: 'This address does not match a page on this site.',
      lede: 'The link may be old or mistyped. Nothing in your project was changed, and nothing on your side was lost.',
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
              If a link on this site brought you here, that is a defect.
              <a href="/contact">Report it</a> and it will be fixed.
            </li>
          </ul>
        `,
      },
    ])}
  `,
};
