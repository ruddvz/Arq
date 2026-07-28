import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-009. The spec says "present approved plans and limits after research".
 * The research has not happened, so this sheet publishes the state of the
 * decision rather than invented tiers. No fabricated prices, ever.
 *
 * Claim bindings: pub-pricing-status (pricing, UNKNOWN) and
 * pub-pricing-lifetime (lifetime-local-access, PROHIBITED). The "stopping
 * payment can never lock you out" line is removed: no commercial decision
 * exists to back it, and a lifetime guarantee is not the site's to give.
 */
export const pricingPage: Page = {
  meta: {
    id: 'PUB-009',
    route: '/pricing',
    title: 'Pricing',
    description:
      'Arq pricing has not been set. The development build is currently available without a paid plan. This page states what is decided, what is being researched, and what is still open.',
  },
  render: () => html`
    ${hero({
      heading: 'Not priced yet.',
      lede: 'Arq has no published plans, no tiers and no prices. This page records the state of that decision so you can see what is settled and what is not.',
    })}
    ${notes([
      {
        title: 'Decided now',
        body: html`
          ${specList([
            {
              term: 'Pre-release costs nothing',
              detail:
                'The development build is currently available without a paid plan. That is the current position, not a commitment about a released product.',
            },
            {
              term: 'The format is documented',
              detail:
                'Projects are local files in a format documented in the repository. Documentation is what Arq can commit to today; it makes no promise about future access terms.',
            },
            {
              term: 'No dark patterns',
              detail:
                'The page specifications for this site prohibit manipulative call-to-action copy, and any future checkout is held to the same rule.',
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
            expect from cancellation.
          </p>
          <p>
            Plans and limits are published here when that research produces an answer, and not
            before.
          </p>
        `,
      },
      {
        title: 'Still open',
        body: html`
          <p>
            Subscription terms, entitlements, what happens to a project archive when a subscription
            ends, and whether there is a perpetual option at all: none of these are decided. They
            need a commercial decision and a legal review before this page can state them. See
            <a href="/legal/terms">terms</a> for the same boundary on the legal side.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Evaluate the work, not the tiers.',
      'The product and changelog pages show what a price would eventually be attached to.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/contact', label: 'Ask a pricing question' },
      ],
    )}
  `,
};
