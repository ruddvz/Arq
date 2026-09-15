/**
 * `workspace-keyboard-map.json` remains the designed shortcut vocabulary.
 * Product-facing labels are advertised only when the canonical product command
 * is actually reachable. Registry presence alone is never shipping evidence.
 */

import { KEYBOARD_COMMANDS, keyboardCommand, type KeyboardCommandContract } from './registry';
import { productCommand } from './product-command-authority';
import type { WorkspacePlatform } from './workspace-types';

export type ShortcutDialect = 'mac' | 'windows' | 'ipad-keyboard' | 'touch-only';

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
  const descriptor = productCommand(commandId);
  if (
    descriptor === null ||
    descriptor.reachability !== 'user-reachable' ||
    !descriptor.surfaces.includes('keyboard') ||
    descriptor.shortcuts === null
  ) {
    return null;
  }

  switch (dialect) {
    case 'mac':
      return descriptor.shortcuts.mac;
    case 'windows':
      return descriptor.shortcuts.windows;
    case 'ipad-keyboard':
      return descriptor.shortcuts.ipadKeyboard;
    case 'touch-only':
      return descriptor.shortcuts.touchOnly;
  }
}

/** Raw design-registry label for audit tooling. Do not use it as reachability evidence. */
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

export function commandsInScope(scope: string): readonly KeyboardCommandContract[] {
  return KEYBOARD_COMMANDS.filter((command) => command.scope === scope);
}

/** Design-registry lookup retained for non-product audit callers. */
export function designedKeyboardCommand(commandId: string): KeyboardCommandContract | null {
  return keyboardCommand(commandId);
}

export interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly isComposing: boolean;
}

export interface ShortcutContext {
  readonly textFieldFocused: boolean;
}

export function shouldHandleShortcut(event: KeyEventLike, context: ShortcutContext): boolean {
  if (event.isComposing) {
    return false;
  }
  if (context.textFieldFocused) {
    return event.key === 'Escape';
  }
  return true;
}

export function isUnmodifiedLetterShortcut(event: KeyEventLike): boolean {
  return (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key.length === 1 &&
    /[a-z]/i.test(event.key)
  );
}
