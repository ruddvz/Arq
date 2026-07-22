import { describe, expect, it } from 'vitest';
import { comboKeyFor, createKeyboardShortcutRegistry } from './keyboard-gesture';

describe('comboKeyFor', () => {
  it('lowercases single-character keys but leaves named keys (Escape, ArrowLeft) alone', () => {
    expect(comboKeyFor({ key: 'Z', ctrlKey: true })).toBe('ctrl+z');
    expect(comboKeyFor({ key: 'ArrowLeft' })).toBe('ArrowLeft');
  });

  it('always orders modifiers ctrl, meta, alt, shift regardless of input order', () => {
    expect(
      comboKeyFor({ key: 'k', shiftKey: true, altKey: true, ctrlKey: true, metaKey: true }),
    ).toBe('ctrl+meta+alt+shift+k');
  });
});

describe('createKeyboardShortcutRegistry', () => {
  it('resolves a registered combo to its command id', () => {
    const registry = createKeyboardShortcutRegistry();
    registry.register('ctrl+z', 'undo');
    expect(registry.dispatch({ key: 'z', ctrlKey: true })).toEqual({
      type: 'shortcut',
      commandId: 'undo',
    });
  });

  it('reports an unregistered combo as unhandled, echoing the canonical combo string', () => {
    const registry = createKeyboardShortcutRegistry();
    expect(registry.dispatch({ key: 'q' })).toEqual({ type: 'unhandled', combo: 'q' });
  });

  it('treats Escape as cancel and Enter as commit even if a shortcut happens to be registered for them', () => {
    const registry = createKeyboardShortcutRegistry();
    registry.register('Escape', 'some-other-command');
    registry.register('Enter', 'yet-another-command');
    expect(registry.dispatch({ key: 'Escape' })).toEqual({ type: 'cancel' });
    expect(registry.dispatch({ key: 'Enter' })).toEqual({ type: 'commit' });
  });

  it('cancel/commit take priority over modifiers on Escape/Enter', () => {
    const registry = createKeyboardShortcutRegistry();
    expect(registry.dispatch({ key: 'Escape', shiftKey: true })).toEqual({ type: 'cancel' });
    expect(registry.dispatch({ key: 'Enter', ctrlKey: true })).toEqual({ type: 'commit' });
  });

  it('unregister removes a binding, reverting it to unhandled', () => {
    const registry = createKeyboardShortcutRegistry();
    registry.register('ctrl+s', 'save');
    registry.unregister('ctrl+s');
    expect(registry.dispatch({ key: 's', ctrlKey: true })).toEqual({
      type: 'unhandled',
      combo: 'ctrl+s',
    });
  });
});
