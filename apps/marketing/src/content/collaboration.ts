import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-005. Viewing, comments, issues and later co-authoring, in that order,
 * because that is the order the release scope commits to.
 *
 * Claim bindings: pub-collaboration-roadmap (sharing-comments-issues, PLANNED)
 * and pub-collaboration-current (collaboration-current, DESIGNED_GATED). Both
 * are bound in planned mode: a designed data model is not a feature.
 */
export const collaborationPage: Page = {
  meta: {
    id: 'PUB-005',
    route: '/collaboration',
    title: 'Collaboration',
    description:
      'How collaboration is scoped to arrive in ARQ: share links and review first, comments and issues next, co-authoring later. The current build has no sharing backend.',
  },
  render: () => html`
    ${hero({
      heading: 'Review first. Co-authoring when it is safe.',
      lede: 'Most architectural collaboration is one person drawing and several people reacting. ARQ is scoped to build that first, and treats simultaneous editing as the hard problem it is.',
    })}
    ${notes([
      {
        title: 'The order of arrival',
        body: html`
          <p>
            Everything in this list is release scope. None of it is available in the current
            development build.
          </p>
          ${specList([
            {
              term: 'Share links',
              detail:
                'Release 2 scope: a controlled, revocable link to view a project without installing anything.',
            },
            {
              term: 'Comments',
              detail:
                'Release 2 scope: anchored to model elements and sheets, resolvable, never silently deleted.',
            },
            {
              term: 'Issues',
              detail:
                'Release 2 scope: actionable design problems with a state, distinct from conversation.',
            },
            {
              term: 'Revision comparison',
              detail:
                'Release 2 scope: see what changed between two revisions before acting on it.',
            },
            {
              term: 'Co-authoring',
              detail:
                'Later, because it is hard. Concurrent geometry editing is deferred until it cannot corrupt a model. CRDT-based data structures for it are being tested as libraries in the repository, which is not the same as a working feature.',
            },
          ])}
        `,
      },
      {
        title: 'Local first does not mean alone',
        body: html`
          <p>
            The design intent is that collaboration layers on top of the local file rather than
            replacing it: your copy of the project stays complete, and sync moves operations between
            copies. That is the architecture the sync protocol is being written against. It has no
            transport and no backend yet, so none of it is running.
          </p>
        `,
      },
      {
        title: 'What exists today',
        body: html`
          <p>
            There is no sharing backend, and this page will say so until there is. The comment and
            issue data models exist with passing tests. The review-mode surfaces are designed and
            gated off in the development build until a real data source exists, and the build shows
            why a control is unavailable rather than presenting it as working.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Built on a file you can trust.',
      'Collaboration is only as good as the file underneath it. Read how ARQ treats your project data.',
      [
        { href: '/security', label: 'Security' },
        { href: '/product', label: 'Product overview' },
      ],
    )}
  `,
};
