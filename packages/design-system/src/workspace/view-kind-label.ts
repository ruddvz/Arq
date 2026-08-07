import type { WorkspaceViewKind } from '@arq/workspace';

/**
 * What a view is, in words a reader recognises.
 *
 * `WorkspaceViewKind` is a registry token - `'3d'`, `'plan'`, `'ai-proposal'` -
 * and the Project overview was rendering it straight into the page beside the
 * view's title. That produced "3D 3d" and "Level 1 Plan plan": an internal
 * identifier printed as product copy, twice over, in the first card on the
 * first surface an opened project shows.
 *
 * The map is exhaustive over the union rather than a lookup with a fallback, so
 * a new kind fails to compile here instead of quietly printing its own token.
 */
const VIEW_KIND_LABELS: Readonly<Record<WorkspaceViewKind, string>> = {
  'project-overview': 'Overview',
  plan: 'Plan',
  '3d': '3D',
  section: 'Section',
  elevation: 'Elevation',
  sheet: 'Sheet',
  schedule: 'Schedule',
  report: 'Report',
  issues: 'Issues',
  compare: 'Compare',
  'model-health': 'Model health',
  'ai-proposal': 'Proposal',
};

export function viewKindLabel(kind: WorkspaceViewKind): string {
  return VIEW_KIND_LABELS[kind];
}

/**
 * The qualifier to show beside a view's title, or null when the title already
 * says it.
 *
 * A list of views is easier to scan when each row says what kind of thing it
 * is - "Ground floor" alone does not distinguish a plan from a ceiling plan.
 * But a view called "Level 1 Plan" does not need "Plan" after it, and a view
 * called "3D" certainly does not need "3D". Repeating a word the reader has
 * just read is noise that looks like a bug, because it is indistinguishable
 * from one.
 */
export function viewKindQualifier(title: string, kind: WorkspaceViewKind): string | null {
  const label = viewKindLabel(kind);
  return title.toLowerCase().includes(label.toLowerCase()) ? null : label;
}
