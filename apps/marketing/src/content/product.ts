import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-002. The complete product direction, release by release, without
 * compatibility overclaims. Scope statements mirror
 * docs/product/RELEASE-SCOPE.md; when that file changes, this sheet must.
 *
 * Claim bindings: pub-product-3d (3d-current, CONFLICTED, must qualify) and
 * pub-product-volatile-count (test-counts, VOLATILE, must qualify). The 3D
 * conflict is recorded in docs/product/voice/conflict-registry.json as
 * CONFLICT-3D-CURRENT-STATUS: STATUS.md asserts both a wired 3D tab and a 3D
 * stack with zero consumers, and no browser capability check covers it. Until
 * that is resolved this sheet describes 3D as Release 1 scope and says the
 * current state is disputed. It must not settle the conflict in either
 * direction.
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
            The current state of the 3D view is disputed in the project's own records: the status
            document describes a wired 3D tab in one section and a 3D stack with no consumers in
            another, and no browser check covers it either way. Arq will not publish it as available
            or as absent until that is resolved. The
            <a href="/changelog">changelog</a> tracks this entry by entry.
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
