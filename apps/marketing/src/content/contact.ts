import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-014. Route sales, support, security and press enquiries. Pre-release
 * honesty: no invented email addresses or support desks — the repository is
 * the real channel today, and each enquiry type says what actually happens.
 */
export const contactPage: Page = {
  meta: {
    id: 'PUB-014',
    route: '/contact',
    title: 'Contact',
    documentTitle: 'Contact and support — Arq',
    description:
      'How to reach the Arq project while it is pre-release: repository issues for product questions and support, private security advisories for vulnerabilities.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-014 · contact and support',
      heading: 'Small project, real channels.',
      lede: 'Arq is pre-release and has no sales team or support desk yet. Rather than publish addresses nobody staffs, this page lists the channels that actually work today.',
    })}
    ${notes([
      {
        title: 'By enquiry',
        body: html`
          ${specList([
              {
                term: 'Product and support',
                detail:
                  'Open an issue in the Arq repository. Issues are read by the people building the product; a reproducible description gets the fastest answer.',
              },
              {
                term: 'Security',
                detail:
                  'Create a private security advisory on the repository. Never report an unpatched vulnerability in a public issue - the security policy explains the process.',
              },
              {
                term: 'Sales and pricing',
                detail:
                  'There is nothing to sell yet. Pricing questions are welcome as repository issues and inform the published pricing research.',
              },
              {
                term: 'Press',
                detail:
                  'Please describe Arq as pre-release software. Claims on this site are deliberately conservative; quoting them keeps you accurate.',
              },
            ])}
        `,
      },
      {
        title: 'When this changes',
        body: html`
          <p>
            A hosted service brings support commitments, and support commitments belong in writing:
            response expectations, escalation and a support address will be published here — and in
            the terms — before any paid plan exists.
          </p>
        `,
      },
    ])}
  `,
};
