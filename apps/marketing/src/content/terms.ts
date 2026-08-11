import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-016. Lawyer-approved terms do not exist, and inventing legal text would
 * be worse than having none.
 *
 * Claim bindings: pub-terms-current (pre-release-terms, UNKNOWN) and
 * pub-terms-future (pricing, UNKNOWN). This sheet states the legal status
 * precisely (nothing here is approved legal terms) and does not promise the
 * content or the timing of future paid-plan terms.
 */
export const termsPage: Page = {
  meta: {
    id: 'PUB-016',
    route: '/legal/terms',
    title: 'Terms',
    family: 'reference',
    documentTitle: 'Terms · ARQ',
    description:
      'ARQ has published no product terms. This page describes the basis on which the pre-release build is offered and is not a legal agreement. Formal terms require legal review.',
  },
  render: () => html`
    ${hero({
      heading: 'No published terms yet.',
      lede: 'Formal product terms need a lawyer and a service worth governing, and neither exists. Nothing on this page has had legal review, and none of it is an agreement.',
    })}
    <div class="measure">
      <dl class="title-block" aria-label="Document status">
        <div>
          <dt class="tb-label">Document</dt>
          <dd>Terms</dd>
        </div>
        <div>
          <dt class="tb-label">Status</dt>
          <dd>Not published: description, not an agreement</dd>
        </div>
        <div>
          <dt class="tb-label">Legal review</dt>
          <dd>None conducted</dd>
        </div>
        <div>
          <dt class="tb-label">Changes</dt>
          <dd>Dated in the changelog</dd>
        </div>
      </dl>
    </div>
    ${notes([
      {
        title: 'Using the pre-release build',
        body: html`
          <p>The following is a description of the current position, not approved legal wording.</p>
          ${specList([
            {
              term: 'As-is',
              detail:
                'Pre-release software changes and breaks. Use it for real work only with the caution you would give any beta, and keep exports of anything you cannot lose.',
            },
            {
              term: 'Your content',
              detail:
                'Drawings and projects you create are yours. ARQ claims no rights over your work.',
            },
            {
              term: 'No service commitments',
              detail:
                'There is no uptime promise, no support commitment and no data-hosting relationship. The build runs on your device and hosts nothing.',
            },
            {
              term: 'Licences',
              detail:
                'Third-party software in ARQ is listed under open-source notices. The licence for ARQ itself is not decided and is recorded in the repository as an open decision.',
            },
          ])}
        `,
      },
      {
        title: 'What is still undecided',
        body: html`
          <p>
            Terms covering a subscription, acceptable use, data processing, availability
            expectations and termination need commercial decisions and a legal review before they
            can be written. Their content and their timing are both open, so this page does not
            preview them.
          </p>
          <p>
            When terms are published, changes are dated, summarised in plain language and announced
            in the <a href="/changelog">changelog</a>.
          </p>
        `,
      },
    ])}
  `,
};
