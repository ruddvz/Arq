import { describe, expect, it, vi } from 'vitest';
import type { StagedNativeProject } from '@arq/project-loading';
import {
  activateProject,
  closeActiveProject,
  isReadOnly,
  showLevel,
  NO_NATIVE_PROJECT,
  type ActiveProjectState,
} from './active-project';
import type { ArqfsSelectedBytesSession } from './arqfs-worker-transport';

function session(name: string): ArqfsSelectedBytesSession {
  return {
    transport: {} as ArqfsSelectedBytesSession['transport'],
    dispose: vi.fn(() => undefined),
    crashed: () => false,
    // Carried purely so a failed assertion names which session leaked.
    toString: () => name,
  } as unknown as ArqfsSelectedBytesSession;
}

function staged(levelIds: readonly string[]): StagedNativeProject {
  return {
    model: { levels: levelIds.map((id) => ({ id, name: id, elevation: 0 })) },
  } as unknown as StagedNativeProject;
}

function activeState(levelIds: readonly string[], named: string): ActiveProjectState {
  return activateProject(NO_NATIVE_PROJECT, {
    fileName: `${named}.arq`,
    staged: staged(levelIds),
    session: session(named),
  }).state;
}

describe('active project state', () => {
  it('starts on the workspace plan document, which is not read-only', () => {
    expect(NO_NATIVE_PROJECT.kind).toBe('local-plan');
    expect(isReadOnly(NO_NATIVE_PROJECT)).toBe(false);
  });

  it('shows the project first level on activation, and reports read-only', () => {
    const outcome = activateProject(NO_NATIVE_PROJECT, {
      fileName: 'house.arq',
      staged: staged(['lvl-gf', 'lvl-uf']),
      session: session('a'),
    });

    expect(outcome.state.kind).toBe('native-read-only');
    if (outcome.state.kind !== 'native-read-only') return;
    expect(outcome.state.project.activeLevelId).toBe('lvl-gf');
    expect(isReadOnly(outcome.state)).toBe(true);
    // Nothing existed to release.
    expect(outcome.disposeSessions).toEqual([]);
  });

  it('hands back the previous project session when one project replaces another', () => {
    const first = activeState(['lvl-gf'], 'first');
    const previousSession = first.kind === 'native-read-only' ? first.project.session : null;

    const outcome = activateProject(first, {
      fileName: 'second.arq',
      staged: staged(['lvl-a']),
      session: session('second'),
    });

    // The Worker and the whole resident database of the replaced project have to
    // be released, and after the new project is in place, not before.
    expect(outcome.disposeSessions).toEqual([previousSession]);
    expect(outcome.state.kind === 'native-read-only' && outcome.state.project.fileName).toBe(
      'second.arq',
    );
    // A reducer, not a disposer: nothing was released as a side effect of asking.
    expect(previousSession?.dispose).not.toHaveBeenCalled();
  });

  it('releases the project session on close and returns to the plan document', () => {
    const open = activeState(['lvl-gf'], 'only');
    const openSession = open.kind === 'native-read-only' ? open.project.session : null;

    const outcome = closeActiveProject(open);

    expect(outcome.state.kind).toBe('local-plan');
    expect(outcome.disposeSessions).toEqual([openSession]);
  });

  it('closing with no project open releases nothing', () => {
    expect(closeActiveProject(NO_NATIVE_PROJECT)).toEqual({
      state: NO_NATIVE_PROJECT,
      disposeSessions: [],
    });
  });

  it('switches to a level the project defines', () => {
    const open = activeState(['lvl-gf', 'lvl-uf'], 'house');

    const next = showLevel(open, 'lvl-uf');

    expect(next.kind === 'native-read-only' && next.project.activeLevelId).toBe('lvl-uf');
  });

  it('ignores a level the project does not define', () => {
    const open = activeState(['lvl-gf'], 'house');

    // Storing it would render an empty plan, which reads as an empty project.
    expect(showLevel(open, 'lvl-nonexistent')).toBe(open);
    expect(showLevel(NO_NATIVE_PROJECT, 'lvl-gf')).toBe(NO_NATIVE_PROJECT);
  });

  it('returns the same state when the requested level is already shown', () => {
    const open = activeState(['lvl-gf'], 'house');

    // Identity, so a React consumer does not re-render for a no-op.
    expect(showLevel(open, 'lvl-gf')).toBe(open);
  });
});
