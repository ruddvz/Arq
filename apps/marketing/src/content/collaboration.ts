import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-005. Viewing, comments, issues and later co-authoring — in that order,
 * because that is the order the release scope commits to.
 */
export const collaborationPage: Page = {
  meta: {
    id: 'PUB-005',
    route: '/collaboration',
    title: 'Collaboration',
    description:
      'How collaboration arrives in Arq: share links and review first, comments and issues next, co-authoring only when it can be done without corrupting anyone’s model.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-005 · collaboration',
      heading: 'Review first. Co-authoring when it is safe.',
      lede: 'Most architectural collaboration is one person drawing and several people reacting. Arq builds that reality first, and treats simultaneous editing as the hard problem it is.',
    })}
    ${notes([
      {
        title: 'The order of arrival',
        body: html`
          ${specList([
            {
              term: 'Share links',
              detail:
                'Release 2 - a controlled, revocable link to view a project without installing anything.',
            },
            {
              term: 'Comments',
              detail:
                'Release 2 - anchored to model elements and sheets, resolvable, never silently deleted.',
            },
            {
              term: 'Issues',
              detail:
                'Release 2 - actionable design problems with a state, distinct from conversation.',
            },
            {
              term: 'Revision comparison',
              detail: 'Release 2 - see what changed between two revisions before acting on it.',
            },
            {
              term: 'Co-authoring',
              detail:
                'Later, and honestly hard: concurrent geometry editing is explicitly deferred until it cannot corrupt a model. The data structures for it (CRDT-based) are already being tested in the repository.',
            },
          ])}
        `,
      },
      {
        title: 'Local first does not mean alone',
        body: html`
          <p>
            Collaboration in Arq is layered on top of the local file, never instead of it. Your copy
            of the project remains complete and openable offline; sync and sharing move operations
            between copies. A dropped connection degrades to exactly what you already have: a
            working local project.
          </p>
        `,
      },
      {
        title: 'What exists today',
        body: html`
          <p>
            Today there is no sharing backend, and this page will say so until there is. The comment
            and issue data models exist with passing tests; the review-mode surfaces are designed
            and gated off in the development build until a real data source exists — the build shows
            why a control is unavailable rather than pretending it works.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Built on a file you can trust.',
      'Collaboration is only as good as the file underneath it. Read how Arq treats your project data.',
      [
        { href: '/security', label: 'Security' },
        { href: '/product', label: 'Product overview' },
      ],
    )}
  `,
};
