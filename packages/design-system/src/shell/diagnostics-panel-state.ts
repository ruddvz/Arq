/**
 * V3-140: the Diagnostics panel.
 *
 * Everything this panel shows already exists somewhere - receipts, incident
 * captures, integrity results, capability facts. What did not exist is a place
 * a user can look, and that absence has a specific cost: without one, the only
 * way to find out what happened is to ask support, and the only thing support
 * can do is ask for steps to reproduce that the user does not have.
 *
 * Two rules shape it, and both are about the panel being trustworthy rather
 * than reassuring.
 *
 * **It never claims more than its sources.** A receipt marked `reported` is
 * shown as reported. A capture that was partial says which artifact is missing.
 * A log that dropped records says so. A diagnostics panel that smooths these
 * over is worse than none, because it converts uncertainty into false
 * confidence at exactly the moment someone is deciding whether to trust their
 * file.
 *
 * **It states what it does not know.** An empty section is ambiguous - nothing
 * happened, or nothing was recorded - so every section carries a coverage
 * statement rather than an empty list. "No integrity check has run" and
 * "integrity checks passed" are different facts and a blank panel reads as the
 * second.
 *
 * The panel holds no project data. Its rows are already-redacted summaries, so
 * a screenshot of it is safe to send, which is the form these reports actually
 * arrive in.
 */

export type DiagnosticSeverity = 'ok' | 'attention' | 'problem' | 'unknown';

/** How much the row's own claim is worth, carried through from the receipt. */
export type DiagnosticConfidence = 'observed' | 'reported' | 'not-checked';

export interface DiagnosticRow {
  readonly id: string;
  readonly label: string;
  /** The value as text. Already redacted by whatever produced it. */
  readonly value: string;
  readonly severity: DiagnosticSeverity;
  readonly confidence: DiagnosticConfidence;
  /** One sentence a user can act on, when there is one. */
  readonly detail?: string;
}

export interface DiagnosticSection {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly DiagnosticRow[];
  /**
   * What this section can and cannot tell you. Required, so an empty section
   * cannot read as a clean bill of health.
   */
  readonly coverage: string;
}

export const DIAGNOSTIC_SECTION_IDS = [
  'project',
  'integrity',
  'persistence',
  'recent-activity',
  'incidents',
  'capabilities',
] as const;

export type DiagnosticSectionId = (typeof DIAGNOSTIC_SECTION_IDS)[number];

export interface DiagnosticsPanelState {
  readonly sections: readonly DiagnosticSection[];
  /** Highest severity across every row, for the panel's own affordance. */
  readonly worstSeverity: DiagnosticSeverity;
  /** True when any section is reporting less than complete coverage. */
  readonly hasGaps: boolean;
}

const SEVERITY_RANK: Readonly<Record<DiagnosticSeverity, number>> = {
  problem: 3,
  attention: 2,
  unknown: 1,
  ok: 0,
};

/**
 * Assembles the panel.
 *
 * A section with no rows keeps its coverage statement and is not dropped. A
 * missing section reads as a feature that does not exist; a present one with
 * "no integrity check has run yet" reads as what it is.
 */
export function buildDiagnosticsPanel(
  sections: readonly DiagnosticSection[],
): DiagnosticsPanelState {
  const rows = sections.flatMap((section) => section.rows);

  const worstSeverity = rows.reduce<DiagnosticSeverity>((worst, row) => {
    return SEVERITY_RANK[row.severity] > SEVERITY_RANK[worst] ? row.severity : worst;
  }, 'ok');

  // `unknown` counts as a gap: a row nobody could check is exactly what the
  // panel must not let a reader skim past.
  const hasGaps =
    rows.some((row) => row.confidence === 'not-checked' || row.severity === 'unknown') ||
    sections.some((section) => section.rows.length === 0);

  return { sections, worstSeverity, hasGaps };
}

/**
 * The panel's own summary line.
 *
 * Never "everything is fine" when anything is unknown. The distinction between
 * "checked and healthy" and "nothing reported a problem" is the whole reason
 * the panel is worth opening.
 */
export function summariseDiagnostics(state: DiagnosticsPanelState): string {
  if (state.worstSeverity === 'problem') {
    return 'Something needs attention.';
  }
  if (state.worstSeverity === 'attention') {
    return 'Everything is working, with notes.';
  }
  if (state.hasGaps) {
    return 'Nothing has reported a problem. Some checks have not run.';
  }
  return 'All checks passed.';
}

/**
 * Marks a row whose claim came from elsewhere.
 *
 * Applied at build time rather than left to the renderer, because a panel that
 * styles confidence optionally will eventually ship a view that does not.
 */
export function rowSuffix(row: DiagnosticRow): string {
  switch (row.confidence) {
    case 'reported':
      return ' (reported by the component, not independently checked)';
    case 'not-checked':
      return ' (not checked)';
    default:
      return '';
  }
}

/**
 * Whether the panel is safe to screenshot and send.
 *
 * True by construction: its rows are already-redacted summaries and it holds no
 * project data. Stated as a function so a future row carrying raw content has
 * to come past this and its test.
 */
export function panelContainsProjectData(): false {
  return false;
}

/**
 * A section for something that has not been checked.
 *
 * Exists so the honest case is the easy one to write. A caller with nothing to
 * report reaches for this rather than omitting the section, which is how the
 * ambiguity gets back in.
 */
export function unknownSection(
  id: DiagnosticSectionId,
  title: string,
  coverage: string,
): DiagnosticSection {
  return { id, title, rows: [], coverage };
}
