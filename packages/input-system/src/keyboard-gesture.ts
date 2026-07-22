/**
 * ARQ-037: keyboard input abstraction.
 *
 * Turns raw key samples into semantic intents a tool/command can react to,
 * without depending on KeyboardEvent (plain {key, ctrlKey, ...} samples, so
 * this is testable without a browser and independent of any input library
 * choice - same rationale as pointer-gesture.ts and touch-gesture.ts).
 *
 * Escape and Enter are reserved: every in-progress editor tool needs a
 * uniform way to cancel or commit, so those two keys always resolve to
 * `cancel` / `commit` regardless of modifiers or what shortcuts are
 * registered, rather than being just another bindable shortcut.
 */

export interface KeySample {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
}

export type KeyboardIntent =
  | { readonly type: 'cancel' }
  | { readonly type: 'commit' }
  | { readonly type: 'shortcut'; readonly commandId: string }
  | { readonly type: 'unhandled'; readonly combo: string };

/**
 * Canonicalizes a key sample into a lookup string, e.g. `{ key: 'Z', ctrlKey:
 * true, shiftKey: true }` -> `"ctrl+shift+z"`. Modifier order is fixed so
 * the same physical combo always produces the same string no matter what
 * order the underlying event reports the modifiers in.
 */
export function comboKeyFor(sample: KeySample): string {
  const parts: string[] = [];
  if (sample.ctrlKey) parts.push('ctrl');
  if (sample.metaKey) parts.push('meta');
  if (sample.altKey) parts.push('alt');
  if (sample.shiftKey) parts.push('shift');
  parts.push(sample.key.length === 1 ? sample.key.toLowerCase() : sample.key);
  return parts.join('+');
}

export function createKeyboardShortcutRegistry() {
  const bindings = new Map<string, string>();

  function register(combo: string, commandId: string): void {
    bindings.set(combo, commandId);
  }

  function unregister(combo: string): void {
    bindings.delete(combo);
  }

  function dispatch(sample: KeySample): KeyboardIntent {
    if (sample.key === 'Escape') {
      return { type: 'cancel' };
    }
    if (sample.key === 'Enter') {
      return { type: 'commit' };
    }
    const combo = comboKeyFor(sample);
    const commandId = bindings.get(combo);
    if (commandId !== undefined) {
      return { type: 'shortcut', commandId };
    }
    return { type: 'unhandled', combo };
  }

  return { register, unregister, dispatch };
}
