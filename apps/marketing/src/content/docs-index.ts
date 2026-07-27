import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-011. Routes users to learning and technical documentation. Hosted docs
 * do not exist yet; the honest index describes the documentation that ships
 * in the repository and the help-centre plan (help/HELP-CENTRE-IA.md).
 */
export const docsIndexPage: Page = {
  meta: {
    id: 'PUB-011',
    route: '/docs',
    title: 'Docs',
    documentTitle: 'Documentation — Arq',
    description:
      'Where Arq documentation lives today: the engineering blueprint, architecture decision records, format plans and page specifications in the repository — with a hosted help centre planned.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-011 · documentation index',
      heading: 'Documented before it is finished.',
      lede: 'Arq is developed specification-first: the documentation is in the repository next to the code it describes, and much of it is enforced by tests. A hosted help centre follows the first release.',
    })}
    ${notes([
      {
        title: 'Technical documentation, in the repository today',
        body: html`
          ${specList([
            {
              term: 'Product blueprint',
              detail:
                'docs/product/ - the complete engineering blueprint, requirements, release scope and feature matrix.',
            },
            {
              term: 'Decisions',
              detail:
                'docs/adr/ - numbered architecture decision records; live decisions outrank any older document.',
            },
            {
              term: 'File format',
              detail:
                'docs/architecture/ and packages/arqfs/ - the .arq SQLite container, migration and recovery rules.',
            },
            {
              term: 'Exchange plans',
              detail:
                'docs/interoperability/ - per-format plans and the support matrix this site mirrors.',
            },
            {
              term: 'Surfaces',
              detail:
                'docs/pages/ - a specification for all 57 product and site surfaces, including this page.',
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
            troubleshooting, recovery, exchange, account and teams. It will be written against
            shipped behaviour — a help article describing an unshipped feature is a bug under this
            project's rules.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The changelog is documentation too.',
      'Every entry describes verified behaviour of the development build.',
      [
        { href: '/changelog', label: 'Read the changelog' },
        { href: '/contact', label: 'Ask a question' },
      ],
    )}
  `,
};
