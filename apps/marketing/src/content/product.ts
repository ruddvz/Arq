import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-002. The complete product direction, release by release, without
 * compatibility overclaims. Scope statements mirror
 * docs/product/RELEASE-SCOPE.md; when that file changes, this sheet must.
 *
 * Claim bindings: pub-product-3d (3d-current, CURRENT, assert current) and
 * pub-product-volatile-count (test-counts, VOLATILE, must qualify).
 * CONFLICT-3D-CURRENT-STATUS is resolved in
 * docs/product/voice/conflict-registry.json: the run-model-canvas
 * capability check proved the 3D tab reachable, rendering through WebGL2,
 * with plan-shared selection in both directions. This sheet may state the
 * verified viewing-surface behaviour as current; it must not promote 3D
 * authoring, which is not current behaviour.
 */
export const productPage: Page = {
  meta: {
    id: 'PUB-002',
    route: '/product',
    title: 'Product',
    description:
      'What Arq is, what each release is scoped to contain, and what is deliberately out of scope. A plan-first architectural editor with real units and a local project file.',
  },
  render: () => html`
    ${hero({
      heading: 'A plan editor first. Everything else follows.',
      lede: 'Arq starts where architectural work starts: the floor plan. Model elements are intended to carry meaning, so that plans, 3D and schedules become views of one model rather than separate drawings.',
    })}
    ${notes([
      {
        title: 'One model, several views of it',
        body: html`
          <p>
            The design the releases build toward is a single semantic model. You draw walls, place
            doors and windows, and bound rooms in a 2D plan with snapping and millimetre units. The
            same elements appear in an orthographic 3D view with selection kept in sync. Sheets lay
            a plan viewport onto paper and export as vector PDF.
          </p>
          <p>
            That is the target, and the release ladder below is the order it is being built in. It
            is not a description of the current development build.
          </p>
        `,
      },
      {
        title: 'The release ladder',
        body: html`
          <p>
            Release scope is published in the repository and mirrored here, in order. A feature
            moves up this ladder only when the one below it holds. Listing a workflow here does not
            mean it is available in the current development build.
          </p>
          ${specList([
            {
              term: 'Release 1',
              detail:
                'New project, units, levels, image underlay, straight walls, doors, windows, rooms, linear dimensions, text notes, floor plan, basic orthographic 3D, selection sync, inspector, undo/redo, local journal, recovery, .arq archive, one plan sheet, vector PDF.',
            },
            {
              term: 'Release 2',
              detail:
                'DXF linework exchange, IFC viewing and property inspection, import reports, share links, comments, issues, revision comparison.',
            },
            {
              term: 'Release 3',
              detail:
                'ArqScript, explain selection, single-step AI modifications, basic schedules, a controlled IFC export subset, sections and elevations after quality gates.',
            },
            {
              term: 'Release 4',
              detail:
                'Native iPad features: Files integration, Pencil hover, double tap, squeeze on supported hardware, haptic snap feedback, a RoomPlan and LiDAR prototype.',
            },
          ])}
        `,
      },
      {
        title: 'Deliberately deferred',
        body: html`
          <p>
            Curved walls, complex roofs and stairs, a full family editor, photorealistic rendering,
            concurrent geometry editing, IFC authoring, DWG authoring, RVT, structural and MEP, and
            a plugin marketplace are all outside the current plan. Arq would rather do a small set
            of drawings properly than a large set badly.
          </p>
        `,
      },
      {
        title: 'What is running today',
        body: html`
          <p>
            The development build has a working workspace shell: panels, tool rail, tabs, inspector,
            command palette and touch layouts, over the tested <code>.arq</code> format layer. The
            plan canvas draws walls with snapping and selection, validates each operation before it
            is committed, and journals the result locally.
          </p>
          <p>
            The development build also has a working 3D view: opening the 3D tab renders the model,
            and selecting an element on the plan highlights the same element in 3D. That behaviour
            is verified by a headless-browser check in the repository's own quality gates, the same
            way the wall-drawing and local-recovery behaviour is. It is a viewing surface today, not
            a 3D modelling workspace. The <a href="/changelog">changelog</a> tracks this entry by
            entry.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'See it from your side of the desk.',
      'How Arq is being shaped for residential and small-practice work, and what a student can do with it.',
      [
        { href: '/architects', label: 'For architects' },
        { href: '/students', label: 'For students' },
        { href: '/interoperability', label: 'Format support' },
      ],
    )}
  `,
};
