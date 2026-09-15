/**
 * `workspace-keyboard-map.json` and doc 51 define the designed shortcut
 * vocabulary. #420 adds the missing shipping question: a designed shortcut is
 * only advertised when the canonical product command is actually reachable.
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

/**
 * Product-facing shortcut label. Registry presence alone is insufficient: Save
 * and Focus Selection remain designed entries, but are not advertised until a
 * live App handler exists. Escape is the one legacy lifecycle command whose
 * live handler predates #420 and is not represented as a palette/tool command.
 */
export function shortcutLabel(commandId: string, dialect: ShortcutDialect): string | null {
  const command = keyboardCommand(commandId);
  if (command === null) {
    return null;
  }

  if (commandId !== 'escape') {
    const descriptor = productCommand(commandId);
    if (
      descriptor === null ||
      descriptor.reachability !== 'user-reachable' ||
      !descriptor.surfaces.includes('keyboard')
    ) {
      return null;
    }
    if (descriptor.shortcuts === null) {
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

  return shortcutLabelFor(command, dialect);
}

/** Raw registry label for design-audit tooling. Do not use this as reachability evidence. */
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
