import { describe, expect, it } from 'vitest';
import {
  buildDiagnosticsPanel,
  panelContainsProjectData,
  rowSuffix,
  summariseDiagnostics,
  unknownSection,
  type DiagnosticRow,
  type DiagnosticSection,
} from './diagnostics-panel-state';

function row(overrides: Partial<DiagnosticRow> = {}): DiagnosticRow {
  return {
    id: 'integrity',
    label: 'Integrity check',
    value: 'Passed',
    severity: 'ok',
    confidence: 'observed',
    ...overrides,
  };
}

function section(overrides: Partial<DiagnosticSection> = {}): DiagnosticSection {
  return {
    id: 'integrity',
    title: 'Integrity',
    rows: [row()],
    coverage: 'Covers the last integrity check on the open project.',
    ...overrides,
  };
}

describe('buildDiagnosticsPanel', () => {
  it('reports the worst severity across every row', () => {
    const state = buildDiagnosticsPanel([
      section({ rows: [row(), row({ id: 'b', severity: 'attention' })] }),
    ]);

    expect(state.worstSeverity).toBe('attention');
  });

  it('lets a problem outrank an attention', () => {
    const state = buildDiagnosticsPanel([
      section({ rows: [row({ severity: 'attention' }), row({ id: 'b', severity: 'problem' })] }),
    ]);

    expect(state.worstSeverity).toBe('problem');
  });

  it('counts an unchecked row as a gap', () => {
    // A row nobody could check is exactly what the panel must not let a reader
    // skim past.
    const state = buildDiagnosticsPanel([
      section({ rows: [row({ confidence: 'not-checked', severity: 'unknown' })] }),
    ]);

    expect(state.hasGaps).toBe(true);
  });

  it('counts an empty section as a gap rather than as health', () => {
    const state = buildDiagnosticsPanel([section({ rows: [] })]);

    expect(state.hasGaps).toBe(true);
    expect(state.worstSeverity).toBe('ok');
  });

  it('keeps an empty section rather than dropping it', () => {
    // A missing section reads as a feature that does not exist.
    const state = buildDiagnosticsPanel([
      unknownSection('integrity', 'Integrity', 'No integrity check has run on this project yet.'),
    ]);

    expect(state.sections).toHaveLength(1);
    expect(state.sections[0]?.coverage).toContain('No integrity check has run');
  });

  it('is clean only when everything was checked and passed', () => {
    const state = buildDiagnosticsPanel([section()]);

    expect(state.hasGaps).toBe(false);
    expect(state.worstSeverity).toBe('ok');
  });
});

describe('summariseDiagnostics', () => {
  it('never says everything is fine when something was not checked', () => {
    // The distinction between "checked and healthy" and "nothing reported a
    // problem" is the whole reason the panel is worth opening.
    const state = buildDiagnosticsPanel([
      section({ rows: [row({ confidence: 'not-checked', severity: 'unknown' })] }),
    ]);

    expect(summariseDiagnostics(state)).toBe(
      'Nothing has reported a problem. Some checks have not run.',
    );
  });

  it('says all checks passed only when they did', () => {
    expect(summariseDiagnostics(buildDiagnosticsPanel([section()]))).toBe('All checks passed.');
  });

  it('leads with a problem', () => {
    const state = buildDiagnosticsPanel([section({ rows: [row({ severity: 'problem' })] })]);

    expect(summariseDiagnostics(state)).toBe('Something needs attention.');
  });

  it('distinguishes working-with-notes from a problem', () => {
    const state = buildDiagnosticsPanel([section({ rows: [row({ severity: 'attention' })] })]);

    expect(summariseDiagnostics(state)).toBe('Everything is working, with notes.');
  });
});

describe('rowSuffix', () => {
  it('marks a reported claim as not independently checked', () => {
    // A panel that styles confidence optionally will eventually ship a view
    // that does not.
    expect(rowSuffix(row({ confidence: 'reported' }))).toContain('not independently checked');
  });

  it('marks an unchecked row', () => {
    expect(rowSuffix(row({ confidence: 'not-checked' }))).toBe(' (not checked)');
  });

  it('adds nothing to an observed row', () => {
    expect(rowSuffix(row())).toBe('');
  });
});

describe('panelContainsProjectData', () => {
  it('is unconditionally false, so the panel is safe to screenshot', () => {
    // Which is the form these reports actually arrive in.
    expect(panelContainsProjectData()).toBe(false);
    expect(panelContainsProjectData.length).toBe(0);
  });
});
