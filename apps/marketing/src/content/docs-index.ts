import { hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-011. Routes users to learning and technical documentation. Hosted docs
 * do not exist yet, so this index describes the documentation that ships in
 * the repository and the help-centre plan (help/HELP-CENTRE-IA.md).
 *
 * Claim bindings: pub-docs-repository (repository-documentation, VOLATILE) and
 * pub-docs-help-centre (hosted-help-centre, PLANNED). Directory contents move,
 * so this sheet names directories and says "at the reviewed revision" rather
 * than counting files.
 */
export const docsIndexPage: Page = {
  meta: {
    id: 'PUB-011',
    route: '/docs',
    title: 'Docs',
    family: 'reference',
    documentTitle: 'Documentation · ARQ',
    description:
      'Where ARQ documentation lives today: the engineering blueprint, architecture decision records, format plans and page specifications in the repository. A hosted help centre is planned.',
  },
  render: () => html`
    ${hero({
      heading: 'Documented before it is finished.',
      lede: 'ARQ is developed specification-first: the documentation sits in the repository next to the code it describes, and much of it is enforced by tests. A hosted help centre follows the first release.',
    })}
    ${notes([
      {
        title: 'Technical documentation, in the repository',
        body: html`
          <p>
            These directories exist at the repository revision this site was built from. Their
            contents change as the work does, so this page names where to look rather than listing
            what is inside.
          </p>
          ${specList([
            {
              term: 'Product blueprint',
              detail:
                'docs/product/ holds the engineering blueprint, requirements, release scope and feature matrix.',
            },
            {
              term: 'Decisions',
              detail:
                'docs/adr/ holds numbered architecture decision records. Live decisions outrank any older document.',
            },
            {
              term: 'File format',
              detail:
                'docs/architecture/ and packages/arqfs/ describe the .arq SQLite container, migration and recovery rules.',
            },
            {
              term: 'Exchange plans',
              detail:
                'docs/interoperability/ holds per-format plans and the support matrix this site mirrors.',
            },
            {
              term: 'Surfaces',
              detail:
                'docs/pages/ holds a specification for every product and site surface, including this page.',
            },
            {
              term: 'Language system',
              detail:
                'docs/product/voice/ holds the canonical vocabulary, claim registry and conflict registry that govern the wording on this site.',
            },
          ])}
        `,
      },
      {
        title: 'The help centre, when it is real',
        body: html`
          <p>
            The planned learner documentation follows the help-centre outline in the repository:
            getting started, navigation, walls, openings, rooms, dimensions, 3D, sheets, export,
            troubleshooting, recovery, exchange, account and teams. It is planned, not published.
          </p>
          <p>
            It will be written against shipped behaviour. Under this project's rules a help article
            describing an unshipped feature is a defect.
          </p>
        `,
      },
    ])}
  `,
};
