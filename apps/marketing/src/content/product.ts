import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-002. The complete product direction, release by release, without
 * compatibility overclaims. Scope statements mirror
 * docs/product/RELEASE-SCOPE.md — when that file changes, this sheet must.
 */
export const productPage: Page = {
  meta: {
    id: 'PUB-002',
    route: '/product',
    title: 'Product',
    description:
      'What Arq is, what each release contains, and what is deliberately out of scope. A plan-first architectural editor with real units, local files and honest limits.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-002 · product overview',
      heading: 'A plan editor first. Everything else follows.',
      lede: 'Arq starts where architectural work starts: the floor plan. Model elements carry meaning — a wall knows it is a wall — so plans, 3D and schedules are views of one model, not separate drawings.',
    })}
    ${notes([
      {
        title: 'One model, several honest views',
        body: html`
          <p>
            You draw walls, place doors and windows, and bound rooms in a 2D plan with snapping and
            millimetre units. The same elements appear in a basic orthographic 3D view with
            selection kept in sync. Sheets lay a plan viewport onto paper and export as vector PDF.
            There is one source of truth and every view says so.
          </p>
        `,
      },
      {
        title: 'The release ladder',
        body: html`
          <p>
            Scope is published in the repository and mirrored here, in order. A feature moves up
            this ladder only when the one below it holds.
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
            concurrent geometry editing, full IFC authoring, DWG authoring, RVT, structural and MEP,
            and a plugin marketplace are all explicitly out of the current plan. Arq would rather do
            a small set of drawings properly than a large set badly.
          </p>
        `,
      },
      {
        title: 'What is running today',
        body: html`
          <p>
            The development build has a working workspace shell — panels, tool rail, tabs,
            inspector, command palette, touch layouts — over a hardened local file format with 175
            tests on the format layer alone. The interactive drawing surface is being wired to it
            now. The <a href="/changelog">changelog</a> tracks this honestly, entry by entry.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'See it from your side of the desk.',
      'How Arq fits residential and small-practice work — and what a student can do with it.',
      [
        { href: '/architects', label: 'For architects' },
        { href: '/students', label: 'For students' },
        { href: '/interoperability', label: 'Format support' },
      ],
    )}
  `,
};
