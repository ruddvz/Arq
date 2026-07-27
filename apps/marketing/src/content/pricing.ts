import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-009. The spec says "present approved plans and limits after research".
 * The research has not happened, so the honest version of this sheet is the
 * state of the decision — not invented tiers. No fabricated prices, ever.
 */
export const pricingPage: Page = {
  meta: {
    id: 'PUB-009',
    route: '/pricing',
    title: 'Pricing',
    description:
      'Arq pricing has not been set. The development build is free to use while Arq is pre-release; this page states what is decided, what is being researched, and what will never change.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-009 · pricing',
      heading: 'Not priced yet — and not pretending to be.',
      lede: 'Most pre-release products publish placeholder tiers and change them later. Arq publishes the actual state of the decision instead.',
    })}
    ${notes([
      {
        title: 'Decided now',
        body: html`
          ${specList([
            {
              term: 'Pre-release is free',
              detail: 'The development build costs nothing to use while Arq is pre-release.',
            },
            {
              term: 'Your file stays yours',
              detail:
                'Whatever pricing becomes, projects are local files in a documented format. Stopping payment can never lock you out of your own archive.',
            },
            {
              term: 'No dark patterns',
              detail:
                'The page specs for this site prohibit manipulative call-to-action copy, and the checkout will be held to the same rule.',
            },
          ])}
        `,
      },
      {
        title: 'Being researched',
        body: html`
          <p>
            The repository's pricing research plan is short and public: understand what small
            practices currently spend, how often projects run, who the buyer is, what PDF, DXF, IFC,
            offline and AI capability are each worth, what students can afford, and what people
            expect from cancellation. Plans and limits get published here when that research
            produces an answer worth standing behind — not before.
          </p>
        `,
      },
      {
        title: 'What this page will become',
        body: html`
          <p>
            Approved plans, stated limits, and an entitlement table that matches the product's
            actual behaviour. Until then, the only honest price list is this explanation.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Evaluate the work, not the tiers.',
      'The product and changelog pages show what your money would eventually buy.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/contact', label: 'Ask a pricing question' },
      ],
    )}
  `,
};
