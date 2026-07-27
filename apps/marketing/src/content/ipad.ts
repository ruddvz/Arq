import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-008. Browser first, native later — and no survey-grade LiDAR claims
 * (prohibited by the SEO brief, and unproven by anyone's hardware).
 */
export const ipadPage: Page = {
  meta: {
    id: 'PUB-008',
    route: '/ipad',
    title: 'iPad',
    description:
      'Arq on iPad: a first-class touch layout in today’s browser build, with native Files, Pencil and RoomPlan integration planned for Release 4.',
  },
  render: () => html`
    ${hero({
      heading: 'The site desk is a desk too.',
      lede: 'Arq treats the iPad as a working surface, not a viewer. The browser build already lays itself out for touch; the native features that need Apple’s APIs come later, in the open.',
    })}
    ${notes([
      {
        title: 'In the browser now',
        body: html`
          <p>
            The development build's workspace detects a coarse pointer and re-composes: a phone dock
            and project bar on small screens, drawers and bottom sheets with real detents on
            tablets, larger touch targets throughout. This is the same app, not a cut-down mobile
            page — the layout system is exercised across eight viewports in the repository's
            capability checks.
          </p>
        `,
      },
      {
        title: 'Native, when it can be real',
        body: html`
          ${specList([
            { term: 'Files integration', detail: 'Release 4 - .arq projects in the Files app.' },
            {
              term: 'Pencil hover and squeeze',
              detail:
                'Release 4 - on hardware that supports them; capability-checked, not assumed.',
            },
            { term: 'Haptic snapping', detail: 'Release 4 - feel a snap engage.' },
            {
              term: 'RoomPlan and LiDAR',
              detail:
                'Release 4 - as a prototype for capturing existing rooms. Captured geometry is a starting point to verify against a tape measure, not a survey.',
            },
          ])}
        `,
      },
      {
        title: 'What Arq will not claim about capture',
        body: html`
          <p>
            Consumer LiDAR is genuinely useful and genuinely imprecise. Arq will never describe a
            phone or tablet scan as measured-survey accuracy, and imported capture will carry its
            provenance so a dimension from a scan is never mistaken for a dimension from a tape.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'One model, wherever you stand.',
      'The same file opens at the studio desk and the site desk — that is the point of building local first.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/changelog', label: 'Changelog' },
      ],
    )}
  `,
};
