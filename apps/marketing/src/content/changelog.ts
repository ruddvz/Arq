import { ctaBand, hero, notes } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-012. Publish release changes. There are no public releases yet, so this
 * is the development log: dated entries matching the repository's merged work,
 * newest first.
 *
 * Claim bindings: pub-changelog-evidence (development-changelog-status,
 * VOLATILE), pub-changelog-3d (3d-current, CURRENT) and
 * pub-changelog-native-open (native-arq-open, LIBRARY_ONLY). Every entry
 * carries an `evidence` line naming the repository paths or checks it rests
 * on, because the binding forbids summary prose from promoting a claim on its
 * own. The 3D entry records the browser evidence that resolved the conflict.
 */
const ENTRIES: readonly {
  readonly date: string;
  readonly title: string;
  readonly category: string;
  readonly body: string;
  readonly evidence: string;
}[] = [
  {
    date: '2026-08-02',
    title: 'MCP proposal boundary added and existing trust defects repaired',
    category: 'AI & trust',
    body: 'The repository gained a 24-tool MCP boundary for scoped reads and reviewable proposals. It has no commit, approve, raw-path or unrestricted-query tool. The same work repaired defects in .arq semantic hashing, worker write enforcement, foreign-key activation, project-scoped writer locks, incomplete WAL-file reporting, failed-migration quarantine, telemetry redaction and status-bar accessibility. The MCP package remains library-only: the application has no project host or Review Centre screen, and no client run is recorded.',
    evidence:
      'Revision 7f15889, PR #292; packages/mcp-server/; docs/adr/0027-mcp-boundary-and-domain-profiles.md; packages/arqfs/; packages/telemetry/; scripts/run-mcp-protocol-capability-check.mjs.',
  },
  {
    date: '2026-07-28',
    title: '3D viewing reachability and local journal recovery verified',
    category: '3D & recovery',
    body: 'Headless-browser checks now open the real 3D tab, render through WebGL2 and prove selection shared with the plan view in both directions. A separate check verifies that acknowledged demo-plan journal operations recover after reload. This establishes a current 3D viewing surface and local journal recovery, not 3D authoring or portable .arq project opening.',
    evidence:
      'Revision 545d334, PR #286; scripts/run-model-canvas-capability-check.mjs; scripts/run-journal-recovery-capability-check.mjs; committed benchmark results.',
  },
  {
    date: '2026-07-27',
    title: 'Language system 4.1: governed vocabulary, claim gates and deployment proof',
    category: 'Language system',
    body: 'The public site, product UI and documentation now share one canonical vocabulary with machine-checked claim and conflict registries. Public copy no longer states disputed 3D reachability, end-to-end import, absolute network behaviour, lifetime access or hardware minimums as current facts. The deployment writes a commit-bound proof into the published artifact, and a post-deployment job checks the live pages against it.',
    evidence:
      'docs/product/voice/ (claim, conflict and binding registries); scripts/verify-arq-*.mjs; the language-system job in .github/workflows/ci.yml; the verify-live-language job in .github/workflows/deploy-pages.yml.',
  },
  {
    date: '2026-07-27',
    title: 'Public site; interactive canvas; validation; local persistence; 3D tab added',
    category: 'Public site & editor',
    body: 'This website ships as a static build, with no JavaScript required, covering every public page in the site specification. In the workspace, the plan canvas gained real interaction: pan, zoom, wall drawing with snapping, point and marquee selection, hover. Every commit is checked by the validation rules with plain-language messages. Edits are journalled to browser storage and replayed on reload, and the save state reports the journal condition rather than a portable file write. A 3D tab was added in the same change, but reachability had not yet been browser-verified. The 28 July entry records the later evidence that resolved it.',
    evidence:
      'apps/marketing/; apps/web/src/PlanCanvas.tsx; packages/validation/; apps/web/src/canvas/plan-journal.ts; conflict CONFLICT-3D-CURRENT-STATUS in docs/product/voice/conflict-registry.json.',
  },
  {
    date: '2026-07-26',
    title: 'Workspace shell completed to its current scope',
    category: 'Workspace shell',
    body: 'Touch compositions (phone dock and bar, drawers, bottom sheets with detents), browser and inspector section systems, tab management with context menus, command palette, keyboard map, and a critique pass fixing defects found by review. The shell reports its true state: no project open, offline.',
    evidence:
      'packages/workspace/; packages/design-system/src/workspace/; the workspace-layout capability check in .github/workflows/ci.yml.',
  },
  {
    date: '2026-07-24',
    title: '.arq foundation hardened; file preflight in the app; CI gates',
    category: 'File format',
    body: 'The .arq SQLite container gained capability-gated open, byte preflight, copy-on-write migration verified by reopen and integrity check, recovery reporting and fuzz tests. The application gained a file panel that checks a chosen file and reports whether it is a compatible ARQ project. That panel stops at its safety verdict; it does not open a working project, and the OPFS worker is still not constructed. Continuous integration began running the full test suite plus headless-browser capability checks.',
    evidence:
      'packages/arqfs/; apps/web/src/file-handling/; workers/arqfs-worker/ (present, not constructed by apps/web).',
  },
  {
    date: '2026-07-23',
    title: 'Rendering and input benchmarks; Rust core',
    category: 'Performance & Rust core',
    body: 'Deterministic benchmarks for Canvas 2D, PixiJS and CanvasKit rendering paths with committed results; pointer and Pencil capability checks; an arq-core Rust crate with a WebAssembly build and parity checks against the TypeScript implementation.',
    evidence: 'benchmarks/results/; rust/; scripts/verify-arq-core-wasm-parity.mjs.',
  },
  {
    date: '2026-07-22',
    title: 'Monorepo initialised from the planning pack',
    category: 'Repository',
    body: 'The specification pack (ordered issue backlog, product blueprint, architecture decision records, page and component specifications) became a pnpm monorepo with strict TypeScript, vitest, turbo and formatting gates from the first commit.',
    evidence: 'backlog/issues/; docs/adr/; pnpm-workspace.yaml; turbo.json.',
  },
];

export const changelogPage: Page = {
  meta: {
    id: 'PUB-012',
    route: '/changelog',
    title: 'Changelog',
    description:
      'The ARQ development log: dated entries describing merged work, each citing the repository paths or checks behind it. No public release has shipped yet.',
  },
  render: () => html`
    ${hero({
      heading: 'What happened, dated.',
      lede: 'No public release has shipped. Until one does, this is the development log. Each entry names the repository paths or checks it rests on, so a summary sentence is never the only evidence for a claim.',
    })}
    <div class="measure changelog-timeline">
      ${ENTRIES.map(
        (entry) => html`
          <section class="changelog-entry">
            <p class="changelog-meta">
              <time datetime="${entry.date}">${entry.date}</time>
              <span class="changelog-category">${entry.category}</span>
            </p>
            <h2>${entry.title}</h2>
            <p class="changelog-summary">${entry.body}</p>
            <details class="changelog-evidence">
              <summary>Evidence</summary>
              <p>${entry.evidence}</p>
            </details>
          </section>
        `,
      )}
    </div>
    ${notes([
      {
        title: 'What a changelog entry can and cannot settle',
        body: html`
          <p>
            An entry records that work was merged. It does not by itself establish that a workflow
            is reachable in the product, and it cannot resolve a contradiction recorded in the
            project's conflict registry. Where sources disagree, the entry says so and the weaker
            wording stands until the disagreement is fixed in code and tests.
          </p>
        `,
      },
      {
        title: 'How releases will be published',
        body: html`
          <p>
            When Release 1 ships, entries here gain version numbers, upgrade notes and, where the
            file format changes, migration notes. The format's rule is already fixed: migration is
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
