import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-014. Route sales, support, security and press enquiries. No invented
 * email addresses or support desks: the repository is the route that exists,
 * and each enquiry type says what actually happens.
 *
 * Claim binding: pub-contact-channels (repository-support-channels, CURRENT).
 * The binding requires the routes to be named with their scope and with the
 * absence of a response-time commitment stated, which is why no channel here
 * is described as staffed.
 */
export const contactPage: Page = {
  meta: {
    id: 'PUB-014',
    route: '/contact',
    title: 'Contact',
    documentTitle: 'Contact and support · Arq',
    description:
      'How to reach the Arq project while it is pre-release: repository issues for product questions, and a private repository security advisory for vulnerabilities. No response time is committed.',
  },
  render: () => html`
    ${hero({
      heading: 'Two routes, both in the repository.',
      lede: 'Arq is pre-release and has no sales team or support desk. Rather than publish addresses nobody staffs, this page lists the routes that exist and what each one is for.',
    })}
    ${notes([
      {
        title: 'By enquiry',
        body: html`
          ${specList([
            {
              term: 'Product and support',
              detail:
                'Open an issue in the Arq repository. Issues go to the people building the product; a reproducible description is the most useful thing you can write.',
            },
            {
              term: 'Security',
              detail:
                'Create a private security advisory on the repository. Never report an unpatched vulnerability in a public issue. The security policy explains the process.',
            },
            {
              term: 'Sales and pricing',
              detail:
                'There is nothing to sell yet. Pricing questions are welcome as repository issues and feed the published pricing research.',
            },
            {
              term: 'Press',
              detail:
                'Please describe Arq as pre-release software. Claims on this site are deliberately conservative, so quoting them keeps you accurate.',
            },
          ])}
          <p>
            No response time is committed for any of these routes. Nobody is on a rota, and this
            page will not suggest otherwise.
          </p>
        `,
      },
      {
        title: 'When this changes',
        body: html`
          <p>
            A hosted service brings support commitments, and support commitments belong in writing.
            Response expectations, escalation and a support address are published here, and in the
            terms, before any paid plan exists.
          </p>
        `,
      },
    ])}
  `,
};
