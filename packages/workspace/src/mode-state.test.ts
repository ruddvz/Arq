import { describe, expect, it } from 'vitest';
import {
  MODE_TOOL_GROUPS,
  allRegistryToolGroups,
  initialModeState,
  isModeAvailable,
  modeUnavailableReason,
  switchMode,
  switchModeIfAvailable,
  toolGroupsForMode,
} from './mode-state';
import { WORKSPACE_MODES, type WorkspaceProjectContext } from './workspace-types';

function project(overrides: Partial<WorkspaceProjectContext> = {}): WorkspaceProjectContext {
  return {
    projectId: 'p1',
    projectName: 'Riverside House',
    documentRevision: 'rev-8',
    openState: 'project-ready',
    saveSync: { local: 'saved-local', sync: 'not-configured' },
    readOnly: false,
    ...overrides,
  };
}

describe('switchMode', () => {
  /**
   * Doc 33: "Mode and view changes preserve the project, current document
   * revision, local save state, sync state, undo boundary, permissions and
   * relevant selection."
   */
  it('preserves project context and selection across the switch', () => {
    const start = initialModeState(project());
    const selected = {
      ...start,
      selection: { primaryId: 'wall-7', secondaryIds: new Set(['wall-8']) },
    };
    const next = switchMode(selected, 'inspect');
    expect(next.project).toBe(selected.project);
    expect(next.selection).toBe(selected.selection);
    expect(next.mode).toBe('inspect');
    expect(next.previousMode).toBe('design');
  });

  it('is a no-op when already in the mode', () => {
    const start = initialModeState(project());
    expect(switchMode(start, 'design')).toBe(start);
  });
});

describe('modeUnavailableReason', () => {
  it('allows every mode on a ready, writable project', () => {
    for (const mode of WORKSPACE_MODES) {
      expect(modeUnavailableReason(project(), mode)).toBeNull();
    }
  });

  it('blocks authoring modes on a read-only project but allows viewing ones', () => {
    const readOnly = project({ readOnly: true });
    expect(modeUnavailableReason(readOnly, 'design')).toBe(
      'You have read-only access to this project',
    );
    expect(modeUnavailableReason(readOnly, 'document')).not.toBeNull();
    expect(modeUnavailableReason(readOnly, 'inspect')).toBeNull();
    expect(modeUnavailableReason(readOnly, 'review')).toBeNull();
    expect(modeUnavailableReason(readOnly, 'present')).toBeNull();
  });

  it('blocks everything but Present while recovery is outstanding', () => {
    const recovering = project({ openState: 'project-recovery-required' });
    expect(modeUnavailableReason(recovering, 'design')).toBe(
      'Recovery must be completed before editing',
    );
    expect(modeUnavailableReason(recovering, 'present')).toBeNull();
  });

  it('blocks every mode while loading or after a fatal open error', () => {
    for (const mode of WORKSPACE_MODES) {
      expect(isModeAvailable(project({ openState: 'project-loading' }), mode)).toBe(false);
      expect(isModeAvailable(project({ openState: 'project-fatal-error' }), mode)).toBe(false);
    }
  });

  it('gives a reason for every unavailable mode rather than a bare false', () => {
    const readOnly = project({ readOnly: true });
    for (const mode of WORKSPACE_MODES) {
      if (!isModeAvailable(readOnly, mode)) {
        expect(modeUnavailableReason(readOnly, mode)).toBeTruthy();
      }
    }
  });
});

describe('switchModeIfAvailable', () => {
  it('refuses rather than throwing when the mode is blocked', () => {
    const start = initialModeState(project({ readOnly: true }));
    expect(switchModeIfAvailable(start, 'design')).toBe(start);
    expect(switchModeIfAvailable(start, 'review').mode).toBe('review');
  });
});

describe('MODE_TOOL_GROUPS', () => {
  it('only names groups the tool registry defines', () => {
    const known = new Set(allRegistryToolGroups());
    for (const mode of WORKSPACE_MODES) {
      for (const group of toolGroupsForMode(mode)) {
        expect(known.has(group)).toBe(true);
      }
    }
  });

  it('covers every mode', () => {
    expect(Object.keys(MODE_TOOL_GROUPS).sort()).toEqual([...WORKSPACE_MODES].sort());
  });

  /** Doc 34: Present is "saved views... with minimal authoring chrome". */
  it('gives Present no authoring groups', () => {
    expect(toolGroupsForMode('present')).toEqual(['View']);
  });
});
