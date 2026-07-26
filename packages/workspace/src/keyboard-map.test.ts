import { describe, expect, it } from 'vitest';
import { KEYBOARD_COMMANDS } from './registry';
import {
  commandsInScope,
  isUnmodifiedLetterShortcut,
  resolveShortcutDialect,
  shortcutLabel,
  shouldHandleShortcut,
  type KeyEventLike,
} from './keyboard-map';

function key(overrides: Partial<KeyEventLike> = {}): KeyEventLike {
  return {
    key: 'w',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    ...overrides,
  };
}

describe('resolveShortcutDialect', () => {
  it('picks labels by input reality, not by layout band alone', () => {
    expect(resolveShortcutDialect('desktop', true, true)).toBe('mac');
    expect(resolveShortcutDialect('desktop', false, true)).toBe('windows');
    expect(resolveShortcutDialect('tablet-landscape', true, true)).toBe('ipad-keyboard');
    expect(resolveShortcutDialect('tablet-landscape', true, false)).toBe('touch-only');
    expect(resolveShortcutDialect('phone', true, true)).toBe('touch-only');
  });
});

describe('shortcutLabel', () => {
  /** Registry rule 4: "Shortcut labels are platform-adapted, not hard-coded Cmd everywhere." */
  it('never shows a Command glyph to a Windows user', () => {
    for (const command of KEYBOARD_COMMANDS) {
      expect(shortcutLabel(command.id, 'windows')).not.toContain('⌘');
    }
    expect(shortcutLabel('command-palette', 'mac')).toBe('⌘K');
    expect(shortcutLabel('command-palette', 'windows')).toBe('Ctrl+K');
  });

  /**
   * Registry rule 3: "Every keyboard-only action needs pointer/touch access."
   * A touch-only dialect returns the reachable path, not null - null would let
   * a caller conclude the command is unavailable on a phone.
   */
  it('gives touch users a real path for every command', () => {
    for (const command of KEYBOARD_COMMANDS) {
      const label = shortcutLabel(command.id, 'touch-only');
      expect(label).toBeTruthy();
      expect(label?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('returns null for an unknown command', () => {
    expect(shortcutLabel('not-a-command', 'mac')).toBeNull();
  });
});

describe('commandsInScope', () => {
  it('partitions the registry by workspace layer', () => {
    expect(commandsInScope('global').map((c) => c.id)).toEqual(['command-palette']);
    expect(commandsInScope('tool').map((c) => c.id)).toEqual(['escape']);
    expect(commandsInScope('view').map((c) => c.id)).toContain('close-tab');
  });
});

describe('shouldHandleShortcut', () => {
  /** Registry rule 2, first half: never fire during IME composition. */
  it('never fires mid-composition, even outside a text field', () => {
    expect(shouldHandleShortcut(key({ isComposing: true }), { textFieldFocused: false })).toBe(
      false,
    );
    expect(shouldHandleShortcut(key({ isComposing: true }), { textFieldFocused: true })).toBe(
      false,
    );
  });

  it('lets a focused text field keep its keystrokes', () => {
    expect(shouldHandleShortcut(key(), { textFieldFocused: true })).toBe(false);
  });

  /** Escape is how a user leaves a field they did not mean to enter. */
  it('always lets Escape through', () => {
    expect(shouldHandleShortcut(key({ key: 'Escape' }), { textFieldFocused: true })).toBe(true);
  });

  it('fires normally outside a text field', () => {
    expect(shouldHandleShortcut(key(), { textFieldFocused: false })).toBe(true);
  });
});

describe('isUnmodifiedLetterShortcut', () => {
  it('ignores anything the browser or OS already owns', () => {
    expect(isUnmodifiedLetterShortcut(key({ key: 'w' }))).toBe(true);
    expect(isUnmodifiedLetterShortcut(key({ key: 'w', metaKey: true }))).toBe(false);
    expect(isUnmodifiedLetterShortcut(key({ key: 'w', ctrlKey: true }))).toBe(false);
    expect(isUnmodifiedLetterShortcut(key({ key: 'w', altKey: true }))).toBe(false);
    expect(isUnmodifiedLetterShortcut(key({ key: 'Escape' }))).toBe(false);
  });
});
