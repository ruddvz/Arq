import { describe, expect, it } from 'vitest';
import { createKeyboardShortcutRegistry } from './keyboard-gesture';
import {
  assertNoDimensionToolConflict,
  KEYBOARD_BASELINE_COMMAND_IDS,
  KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED,
  registerKeyboardBaseline,
} from './keyboard-baseline';

function baselineRegistry() {
  const registry = createKeyboardShortcutRegistry();
  registerKeyboardBaseline(registry);
  return registry;
}

describe('registerKeyboardBaseline', () => {
  it('dispatches V to select', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'v' })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.select,
    });
  });

  it('dispatches W to wall', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'w' })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.wall,
    });
  });

  it('dispatches D to door', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'd' })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.door,
    });
  });

  it('dispatches F to fit-selection and Shift+F to fit-project', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'f' })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.fitSelection,
    });
    expect(registry.dispatch({ key: 'f', shiftKey: true })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.fitProject,
    });
  });

  it('dispatches both Ctrl+Z and Cmd+Z to undo (cross-platform)', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'z', ctrlKey: true })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.undo,
    });
    expect(registry.dispatch({ key: 'z', metaKey: true })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.undo,
    });
  });

  it('dispatches both Ctrl+Shift+Z and Cmd+Shift+Z to redo (cross-platform)', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'z', ctrlKey: true, shiftKey: true })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.redo,
    });
    expect(registry.dispatch({ key: 'z', metaKey: true, shiftKey: true })).toEqual({
      type: 'shortcut',
      commandId: KEYBOARD_BASELINE_COMMAND_IDS.redo,
    });
  });

  it('still reserves Escape and Enter regardless of the baseline being registered', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'Escape' })).toEqual({ type: 'cancel' });
    expect(registry.dispatch({ key: 'Enter' })).toEqual({ type: 'commit' });
  });

  it('reports an unhandled combo for a key outside the baseline', () => {
    const registry = baselineRegistry();
    expect(registry.dispatch({ key: 'q' })).toEqual({ type: 'unhandled', combo: 'q' });
  });

  it('never registers a not-yet-implemented command as a real shortcut', () => {
    const registry = baselineRegistry();
    // 'm' (Move), 'r' (Rotate), 'o' (Offset) are section 29 examples with
    // no backing tool yet - dispatch must report them as unhandled, not
    // silently succeed as if a real command existed.
    expect(registry.dispatch({ key: 'm' })).toEqual({ type: 'unhandled', combo: 'm' });
    expect(registry.dispatch({ key: 'r' })).toEqual({ type: 'unhandled', combo: 'r' });
    expect(registry.dispatch({ key: 'o' })).toEqual({ type: 'unhandled', combo: 'o' });
  });
});

describe('KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED', () => {
  it('lists move, rotate, offset, trim and the command palette', () => {
    expect([...KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED].sort()).toEqual(
      ['command-palette', 'move', 'offset', 'rotate', 'trim'].sort(),
    );
  });

  it('shares no command id with the real, registered baseline', () => {
    const registeredIds: ReadonlySet<string> = new Set(
      Object.values(KEYBOARD_BASELINE_COMMAND_IDS),
    );
    for (const notYetImplemented of KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED) {
      expect(registeredIds.has(notYetImplemented)).toBe(false);
    }
  });
});

describe('assertNoDimensionToolConflict', () => {
  it('is true when no dimension tool is registered', () => {
    expect(assertNoDimensionToolConflict(new Set(['select', 'wall', 'door']))).toBe(true);
  });

  it('is false once a dimension tool command id is registered', () => {
    expect(assertNoDimensionToolConflict(new Set(['select', 'wall', 'door', 'dimension']))).toBe(
      false,
    );
  });
});
