import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-013. Show service health and incidents. There is no hosted service, so
 * the truthful status page reports exactly that — and explains what "down"
 * can and cannot mean for a local-first tool.
 */
export const statusPage: Page = {
  meta: {
    id: 'PUB-013',
    route: '/status',
    title: 'Status',
    description:
      'Arq service status: no hosted service is operating yet, so there is nothing to be down. The development build runs locally in your browser. Incident history begins when hosting does.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-013 · status',
      heading: 'No hosted service. Nothing to be down.',
      lede: 'Arq currently ships as a local development build: the application and your projects live on your device. Until a hosted service exists, a status page has exactly one honest state.',
    })}
    ${notes([
      {
        title: 'Current state',
        body: html`
          ${specList([
              {
                term: 'Hosted services',
                detail: 'None operating. No accounts, no sync, no shared links yet.',
              },
              { term: 'This website', detail: 'Static files. If you can read this, it is up.' },
              {
                term: 'The development build',
                detail:
                  'Runs locally in your browser; its availability is your device’s. Your projects are unaffected by anything on our side - that is the point of local first.',
              },
            ])}
        `,
      },
      {
        title: 'What this page becomes',
        body: html`
          <p>
            When hosted features launch (sharing, sync), this page gains live component status,
            incident reporting with plain-language timelines, and a post-incident record. The
            error-message rules that govern the product apply here too: what happened, why, what was
            affected, what remains safe, what you can do.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Local first is the availability strategy.',
      'Read why Arq is built so that our outage can never be your outage.',
      [
        { href: '/security', label: 'Security' },
        { href: '/product', label: 'Product overview' },
      ],
    )}
  `,
};
