import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-016. Lawyer-approved terms do not exist yet, and inventing legal text
 * would be worse than none. The sheet states the current basis of use and
 * the commitments that will survive into the formal terms.
 */
export const termsPage: Page = {
  meta: {
    id: 'PUB-016',
    route: '/legal/terms',
    title: 'Terms',
    documentTitle: 'Terms — Arq',
    description:
      'The current basis for using pre-release Arq, stated plainly: provided as-is, no service commitments yet, your content remains yours. Formal terms follow legal review before any paid plan.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-016 · terms',
      heading: 'The terms before the terms.',
      lede: 'Formal product terms require a lawyer and a service worth governing. Neither exists yet. What can be stated now, honestly, is the basis on which the pre-release build is offered.',
    })}
    ${notes([
      {
        title: 'Using the pre-release build',
        body: html`
          ${specList([
              {
                term: 'As-is',
                detail:
                  'Pre-release software changes and breaks. Use it for real work only with the caution you would give any beta - and keep exports of anything you cannot lose.',
              },
              {
                term: 'Your content',
                detail:
                  'Drawings and projects you create are yours. Arq claims no rights over your work, now or in any future terms.',
              },
              {
                term: 'No service commitments',
                detail:
                  'There is no uptime promise, no support commitment and no data-hosting relationship - the build runs locally and hosts nothing.',
              },
              {
                term: 'Licences',
                detail:
                  'Third-party software in Arq is listed under open-source notices. The licence for Arq itself is not yet decided and is recorded in the repository as an open decision.',
              },
            ])}
        `,
      },
      {
        title: 'What formal terms will add',
        body: html`
          <p>
            Before any paid plan or hosted service: reviewed terms covering the subscription,
            acceptable use, data processing, availability expectations and termination — with
            cancellation expectations informed by the published pricing research. Changes will be
            dated, summarised in plain language, and announced in the
            <a href="/changelog">changelog</a>, not slipped in.
          </p>
        `,
      },
    ])}
  `,
};
