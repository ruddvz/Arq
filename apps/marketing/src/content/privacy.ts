import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-015. The spec calls for a lawyer-approved privacy notice; none exists.
 *
 * Claim bindings: pub-privacy-current (website-privacy-practice, VOLATILE) and
 * pub-privacy-notice (formal-privacy-notice, PLANNED). The website statements
 * below are the ones the build and the deployment checks can substantiate: the
 * rendered-site verifier fails the build if any page loads a third-party
 * script, style, image, font, frame or CSS url(). Statements about the
 * application build are scoped to its architecture, because no network
 * observation test has been published.
 */
export const privacyPage: Page = {
  meta: {
    id: 'PUB-015',
    route: '/legal/privacy',
    title: 'Privacy',
    documentTitle: 'Privacy notice · Arq',
    description:
      'Arq has not published a formal privacy notice. This page states the practices that the current build and deployment checks can substantiate, and what still needs legal review.',
  },
  render: () => html`
    ${hero({
      heading: 'No formal notice yet. Here is what can be stated.',
      lede: 'A lawyer-reviewed privacy notice is published before any hosted service launches. This page is not that notice. It is a plain-language account of the practices in force at the revision it was built from.',
    })}
    ${notes([
      {
        title: 'This website',
        body: html`
          <p>
            Each statement below is checked when the site is built and again after it is deployed. A
            page that loaded a third-party resource would fail those checks.
          </p>
          ${specList([
            { term: 'Cookies', detail: 'None set by this site.' },
            {
              term: 'Analytics',
              detail: 'None running. No page-view tracking and no third-party scripts.',
            },
            {
              term: 'Requests',
              detail:
                'Every script, style, font and image is served from this site’s own origin. The deployment gate rejects an external resource.',
            },
            {
              term: 'Forms',
              detail: 'There are none. This site collects nothing from you.',
            },
          ])}
        `,
      },
      {
        title: 'The development build',
        body: html`
          ${specList([
            {
              term: 'Your projects',
              detail:
                'Held on your device, in browser storage or in files you choose. There is no Arq server to upload them to.',
            },
            {
              term: 'Accounts',
              detail: 'None exist. There is nothing to sign up for and no profile to build.',
            },
            {
              term: 'Telemetry',
              detail:
                'No telemetry endpoint is configured in the build. A published network-observation test is what would let this page make a stronger statement.',
            },
            {
              term: 'AI training',
              detail:
                'Recorded policy for any future service: no training on private project data by default.',
            },
          ])}
        `,
      },
      {
        title: 'What will change, and how you will know',
        body: html`
          <p>
            Hosted features (accounts, sync, shared links) change the privacy picture, and a formal
            notice precedes them: what is collected, the lawful basis, retention, processors and
            your rights, reviewed by a lawyer before publication.
          </p>
          <p>
            This page keeps its plain-language summary alongside the formal text when that exists,
            and material changes are dated in the <a href="/changelog">changelog</a>.
          </p>
        `,
      },
    ])}
  `,
};
