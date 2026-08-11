import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-013. Show service health and incidents. No hosted service is documented,
 * so this sheet reports that and explains what "down" can and cannot mean.
 *
 * Claim bindings: pub-status-hosted-service (hosted-service-status, VOLATILE)
 * and pub-status-lifetime (lifetime-local-access, PROHIBITED). Service status
 * is volatile by definition, so it is bound to the deployed revision and
 * verified after deployment. The "our outage can never be your outage" line is
 * removed: it was a guarantee about every future condition.
 */
export const statusPage: Page = {
  meta: {
    id: 'PUB-013',
    route: '/status',
    title: 'Status',
    family: 'operational',
    description:
      'ARQ service status: no hosted ARQ service is documented, and this website is served as static files. Incident history begins when hosting does.',
  },
  render: () => html`
    ${hero({
      heading: 'No hosted service is running.',
      lede: 'ARQ currently ships as a local development build: the application and your projects sit on your device. This page states what is documented at the revision it was built from.',
    })}
    ${notes([
      {
        title: 'Current state, at this revision',
        body: html`
          ${specList([
            {
              term: 'Hosted services',
              detail:
                'None documented. No accounts, no sync and no shared links exist in the current build.',
            },
            {
              term: 'This website',
              detail:
                'Static files on GitHub Pages. Its availability is GitHub’s, and each deployment is checked against a proof written into the published artifact.',
            },
            {
              term: 'The development build',
              detail:
                'Runs in your browser and keeps its work on your device, so a problem on this site does not reach an open project. That is a property of the current architecture, not a permanent guarantee.',
            },
          ])}
          <p>
            Service status changes between builds. This page is republished with the site, so treat
            it as current for the revision in the footer and nothing later.
          </p>
        `,
      },
      {
        title: 'What this page becomes',
        body: html`
          <p>
            When hosted features launch, this page gains live component status, incident reporting
            with plain-language timelines, and a post-incident record. The error-message rules that
            govern the product apply here too: what happened, why, what was affected, what remains
            safe, what you can do.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Local first is the availability strategy.',
      'Read how ARQ is built so that a project keeps working without a service behind it.',
      [
        { href: '/security', label: 'Security' },
        { href: '/product', label: 'Product overview' },
      ],
    )}
  `,
};
