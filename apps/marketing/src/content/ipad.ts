import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-008. Browser first, native later, and no survey-grade capture claims
 * (prohibited by the SEO brief).
 *
 * Claim bindings: pub-ipad-touch-layout (ipad-touch-layout, CURRENT),
 * pub-ipad-native-features (ipad-native-features, PLANNED) and
 * pub-ipad-file-reachability (native-arq-open, LIBRARY_ONLY). The touch layout
 * is the one current claim here, and it is bound to the repository's viewport
 * capability check. "The same file opens on both devices" is removed: the
 * opening path is not wired on either.
 */
export const ipadPage: Page = {
  meta: {
    id: 'PUB-008',
    route: '/ipad',
    title: 'iPad',
    description:
      'ARQ on iPad: the browser build has a touch layout checked across the repository’s viewport set. Native Files, Pencil and RoomPlan integration is Release 4 scope.',
  },
  render: () => html`
    ${hero({
      heading: 'The site desk is a desk too.',
      lede: 'ARQ treats the iPad as a working surface rather than a viewer. The browser build already lays itself out for touch. The native features that need Apple’s APIs come later, in the open.',
    })}
    ${notes([
      {
        title: 'In the browser now',
        body: html`
          <p>
            The development build's workspace detects a coarse pointer and re-composes: a phone dock
            and project bar on small screens, drawers and bottom sheets with real detents on
            tablets, larger touch targets throughout. It is the same application rather than a
            cut-down mobile page.
          </p>
          <p>
            The layout is exercised by a headless-browser check in the repository across the
            viewport set in <code>workspace-qa-fixtures.json</code>, which asserts that the canvas
            stays visible, that panels can be summoned back, and that no viewport overflows
            horizontally. That check is the evidence behind this paragraph.
          </p>
        `,
      },
      {
        title: 'Native, when it can be real',
        body: html`
          ${specList([
            {
              term: 'Files integration',
              detail: 'Release 4 scope: .arq projects in the Files app.',
            },
            {
              term: 'Pencil hover and squeeze',
              detail:
                'Release 4 scope, on hardware that supports them. Capability-checked rather than assumed.',
            },
            { term: 'Haptic snapping', detail: 'Release 4 scope: feel a snap engage.' },
            {
              term: 'RoomPlan and LiDAR',
              detail:
                'Release 4 scope, as a prototype for capturing existing rooms. Captured geometry is a starting point to verify against a tape measure, not a survey.',
            },
          ])}
        `,
      },
      {
        title: 'What ARQ will not claim about capture',
        kind: 'limit',
        body: html`
          <p>
            Consumer LiDAR is useful and imprecise at the same time. ARQ will never describe a phone
            or tablet scan as measured-survey accuracy, and imported capture will carry its
            provenance so a dimension from a scan is never mistaken for a dimension from a tape.
          </p>
        `,
      },
      {
        title: 'One format, once the opening path exists',
        body: html`
          <p>
            The design intent is a single project format that behaves the same at the studio desk
            and the site desk. Today neither the browser build nor a native build opens an existing
            <code>.arq</code> file into a working project, so this page does not claim that a file
            moves between devices. See <a href="/">how files are handled today</a>.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'One model, wherever you stand.',
      'That is the point of building on a local project format. The product page explains the order the pieces arrive in.',
      [
        { href: '/product', label: 'Product overview' },
        { href: '/changelog', label: 'Changelog' },
      ],
    )}
  `,
};
