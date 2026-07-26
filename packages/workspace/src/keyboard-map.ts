/**
 * `workspace-keyboard-map.json` and doc 51 ("Workspace Accessibility and Input
 * Contracts").
 *
 * The registry's fourth rule is the one this module implements: "Shortcut
 * labels are platform-adapted, not hard-coded Cmd everywhere." A Windows user
 * shown `⌘K` has been shown a shortcut that does not exist on their machine.
 *
 * The registry's third rule - "Every keyboard-only action needs pointer/touch
 * access" - is why `shortcutLabel` returns the phone entry as prose ("bottom
 * dock > More > Commands") rather than null: on a phone the command still has a
 * path, it just is not a keystroke, and returning null would let a caller
 * conclude the command is unreachable there.
 */

import { KEYBOARD_COMMANDS, keyboardCommand, type KeyboardCommandContract } from './registry';
import type { WorkspacePlatform } from './workspace-types';

/**
 * Which shortcut vocabulary to print. Separate from `WorkspacePlatform`
 * because they answer different questions: platform decides *layout*, this
 * decides *label*, and a Windows laptop with a touchscreen needs the Windows
 * labels whichever layout band its width lands in.
 */
export type ShortcutDialect = 'mac' | 'windows' | 'ipad-keyboard' | 'touch-only';

/**
 * `navigator.platform` is not consulted here; the caller passes what it knows.
 * A pure function is testable, and platform sniffing belongs at the one edge of
 * the app that already has to do it.
 */
export function resolveShortcutDialect(
  platform: WorkspacePlatform,
  applePlatform: boolean,
  hasPhysicalKeyboard: boolean,
): ShortcutDialect {
  if (platform === 'phone') {
    return 'touch-only';
  }
  if (platform === 'tablet-portrait' || platform === 'tablet-landscape') {
    return hasPhysicalKeyboard ? 'ipad-keyboard' : 'touch-only';
  }
  return applePlatform ? 'mac' : 'windows';
}

export function shortcutLabel(commandId: string, dialect: ShortcutDialect): string | null {
  const command = keyboardCommand(commandId);
  if (command === null) {
    return null;
  }
  return shortcutLabelFor(command, dialect);
}

export function shortcutLabelFor(
  command: KeyboardCommandContract,
  dialect: ShortcutDialect,
): string {
  switch (dialect) {
    case 'mac':
      return command.mac;
    case 'windows':
      return command.windows;
    case 'ipad-keyboard':
      return command.ipadKeyboard;
    case 'touch-only':
      return command.phone;
  }
}

/**
 * Commands scoped to a given layer. `workspace-keyboard-map.json` >
 * `commands[].scope` is `global`/`project`/`tool`/`view`/`design`, matching doc
 * 33's workspace layers - a `tool`-scoped shortcut must not fire while the
 * project is still loading and there is no tool to cancel.
 */
export function commandsInScope(scope: string): readonly KeyboardCommandContract[] {
  return KEYBOARD_COMMANDS.filter((command) => command.scope === scope);
}

export interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  /** `KeyboardEvent.isComposing`. */
  readonly isComposing: boolean;
}

export interface ShortcutContext {
  /** True while a text input, textarea or contenteditable owns the keystroke. */
  readonly textFieldFocused: boolean;
}

/**
 * `workspace-keyboard-map.json` > rules 1 and 2: "Never steal OS-reserved
 * shortcuts. Do not fire shortcuts during IME composition or when a text field
 * owns the command."
 *
 * IME composition is checked first and unconditionally. A Japanese or Chinese
 * user mid-composition is pressing keys that belong to the input method, and
 * treating those as tool shortcuts is the classic way a Latin-alphabet-only
 * test suite ships an unusable editor.
 *
 * Escape is the deliberate exception to the text-field rule: it is how a user
 * escapes a field they did not mean to be in, so a shell that swallows it
 * traps them.
 */
export function shouldHandleShortcut(event: KeyEventLike, context: ShortcutContext): boolean {
  if (event.isComposing) {
    return false;
  }
  if (context.textFieldFocused) {
    return event.key === 'Escape';
  }
  return true;
}

/**
 * Whether a plain single-letter shortcut (`V` for select, `W` for wall) applies.
 * Any modifier means the keystroke belongs to the browser or the OS - `⌘W`
 * closes a tab, and a wall tool that hijacked it would be closing the user's
 * project instead.
 */
export function isUnmodifiedLetterShortcut(event: KeyEventLike): boolean {
  return (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key.length === 1 &&
    /[a-z]/i.test(event.key)
  );
}
