import { ctaBand, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-012. Publish release changes. There are no public releases yet, so the
 * honest changelog is the development log: dated, factual entries matching
 * the repository's actual merged work. Entries are newest first.
 */
const ENTRIES: readonly {
  readonly date: string;
  readonly title: string;
  readonly body: string;
}[] = [
  {
    date: '2026-07-27',
    title: 'Public site; interactive canvas; validation; local persistence; basic 3D',
    body: 'This website ships as a static, no-JavaScript-required build with every public page from the site specification. In the workspace, the plan canvas gains real interaction (pan, zoom, wall drawing with snapping, point and marquee selection, hover), every commit is checked by the new validation rules with plain-language messages, edits are journalled to browser storage and recovered on reload with honest save states, and a 3D tab renders drawn walls as extruded solids with orbit, fit, and selection shared with the plan.',
  },
  {
    date: '2026-07-26',
    title: 'Workspace completed to its current honest scope',
    body: 'Touch compositions (phone dock and bar, drawers, bottom sheets with detents), browser and inspector section systems, tab management with context menus, command palette, keyboard map, and a critique pass fixing defects found by review. The shell reports save state honestly: no project open, offline.',
  },
  {
    date: '2026-07-24',
    title: '.arq foundation hardened; real file-open flow; CI gates',
    body: 'The .arq SQLite container gained capability-gated open, byte preflight, copy-on-write migration verified by reopen and integrity check, recovery reporting and fuzz tests - 175 tests on the format layer. The app gained a real file-open panel that verifies files before claiming anything. CI now runs the full test suite plus six headless-browser capability checks.',
  },
  {
    date: '2026-07-23',
    title: 'Rendering and input benchmarks; Rust core',
    body: 'Deterministic benchmarks for Canvas 2D, PixiJS and CanvasKit rendering paths with committed results; pointer and Pencil capability checks; an arq-core Rust crate with a WebAssembly build and parity checks against the TypeScript implementation.',
  },
  {
    date: '2026-07-22',
    title: 'Monorepo initialised from the planning pack',
    body: 'The specification pack (242 ordered issues, product blueprint, ADRs, page and component specifications) became a pnpm monorepo: 30 packages, 3 apps and workers, strict TypeScript, vitest, turbo and formatting gates from the first commit.',
  },
];

export const changelogPage: Page = {
  meta: {
    id: 'PUB-012',
    route: '/changelog',
    title: 'Changelog',
    description:
      'The Arq development log: dated, factual entries describing what is actually built and tested. No public releases have shipped yet; this page will carry them when they do.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'PUB-012 · changelog',
      heading: 'What actually happened, dated.',
      lede: 'No public release has shipped yet. Until one does, this is the development log — each entry summarises work that is merged, tested and real, not intended.',
    })}
    <div class="measure">
      ${ENTRIES.map(
        (entry) => html`
          <section class="note">
            <h2>
              <span class="note-number" aria-hidden="true">${entry.date.slice(5)}</span>
              ${entry.title}
            </h2>
            <div class="note-body">
              <p><time datetime="${entry.date}">${entry.date}</time> — ${entry.body}</p>
            </div>
          </section>
        `,
      )}
    </div>
    ${notes([
      {
        title: 'How releases will be published',
        body: html`
          <p>
            When Release 1 ships, entries here gain version numbers, upgrade notes and — where the
            file format changes — migration notes. The format's rule is already fixed: migration is
            copy-on-write and recoverable, so an upgrade can never be a one-way door.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'The scope those entries build toward.',
      'The release ladder shows where this work is heading, in order.',
      [{ href: '/product', label: 'Product overview' }],
    )}
  `,
};
