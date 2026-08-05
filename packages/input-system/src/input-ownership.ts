/**
 * V3-101 / AC3-081: keyboard commands do not fire while a text input owns focus.
 *
 * The failure this rules out is specific and cheap to hit: a user types a room
 * name, presses `W`, and the wall tool activates behind the field. The name
 * loses a character, a wall appears, and neither the name nor the drawing is
 * what was meant. `createKeyboardShortcutRegistry.dispatch` (ARQ-037) has no
 * concept of focus - it maps a key to a command every time it is asked - so
 * the decision has to live somewhere, and everywhere is the wrong place. This
 * module is the one place.
 *
 * The rule is total by default: while a text entry owns focus, keys reach the
 * text entry and nothing else. There is no built-in list of shortcuts that
 * punch through, because every candidate for such a list already means
 * something inside a text field. Ctrl+Z is the field's undo. Escape clears the
 * field (numeric-overlay.ts already implements exactly that, and defocuses only
 * once the field is empty, which is how ownership is released). Enter commits
 * the field. Guessing that any of these belong to the canvas is how entry gets
 * corrupted; a caller with a genuine window-level shortcut must name it in
 * `alwaysReachesCommands`, which is empty unless someone opts in.
 *
 * The one structural exception is a `command-field`: the numeric overlay's
 * distance and angle inputs are text entries that belong *to* a running
 * command. numeric-overlay.ts says so itself - "Enter has no behaviour of its
 * own here; committing the resolved point is the caller's command lifecycle" -
 * so for that role, and only that role, Enter resolves to the command's
 * `commit`. Every other key, Escape included, still goes to the field.
 */

import type { KeyboardIntent, KeySample } from './keyboard-gesture';
import { comboKeyFor } from './keyboard-gesture';

/**
 * What kind of text entry holds focus.
 *
 * `document-text` is a field whose content is project data - a room name, a
 * sheet title, a comment. Nothing it receives is a canvas command.
 *
 * `command-field` is a field a running command owns, currently the numeric
 * overlay. Its content is an argument to that command rather than project data,
 * which is why its Enter is the command's commit.
 */
export type TextEntryRole = 'document-text' | 'command-field';

export type InputOwner =
  | { readonly kind: 'canvas' }
  | {
      readonly kind: 'text-entry';
      readonly fieldId: string;
      readonly role: TextEntryRole;
    };

export const CANVAS_OWNER: InputOwner = { kind: 'canvas' };

export type InputRouting =
  | { readonly target: 'text-entry'; readonly fieldId: string }
  | { readonly target: 'command'; readonly intent: KeyboardIntent };

export interface KeyboardDispatcher {
  dispatch(sample: KeySample): KeyboardIntent;
}

export interface RouteKeyOptions {
  /**
   * Combos that reach the command layer even while a text entry owns focus,
   * as produced by `comboKeyFor`. Empty by default and deliberately so: a
   * caller that needs one is asserting the combo has no meaning inside a text
   * field, and that assertion should be visible in its code rather than
   * inherited from a default someone else chose.
   */
  readonly alwaysReachesCommands?: ReadonlySet<string>;
}

/**
 * Decides where a key goes.
 *
 * Returns a routing rather than performing it, so the same decision is
 * testable without a DOM and so a caller cannot accidentally act on both
 * branches - the bug this exists to prevent is precisely a key being handled
 * twice.
 */
export function routeKeySample(
  owner: InputOwner,
  sample: KeySample,
  dispatcher: KeyboardDispatcher,
  options: RouteKeyOptions = {},
): InputRouting {
  if (owner.kind === 'canvas') {
    return { target: 'command', intent: dispatcher.dispatch(sample) };
  }

  const escapeHatch = options.alwaysReachesCommands;
  if (escapeHatch && escapeHatch.has(comboKeyFor(sample))) {
    return { target: 'command', intent: dispatcher.dispatch(sample) };
  }

  // A command field's Enter is the owning command's commit, not the field's:
  // typing a distance and pressing Enter places the point.
  if (owner.role === 'command-field' && sample.key === 'Enter') {
    return { target: 'command', intent: { type: 'commit' } };
  }

  return { target: 'text-entry', fieldId: owner.fieldId };
}

/**
 * Tracks which surface owns keyboard input.
 *
 * Focus and blur arrive out of order in a real DOM: moving between two fields
 * fires the new field's focus before the old field's blur. A tracker that
 * handed ownership back to the canvas on any blur would therefore drop the user
 * out of text entry mid-word, which is the same corruption this module exists
 * to prevent, arriving by a different route. So `blurTextEntry` names the field
 * it is blurring and is ignored unless that field is the current owner.
 */
export function createInputOwnershipTracker() {
  let current: InputOwner = CANVAS_OWNER;

  function owner(): InputOwner {
    return current;
  }

  function focusTextEntry(fieldId: string, role: TextEntryRole): void {
    current = { kind: 'text-entry', fieldId, role };
  }

  /** Ignored if `fieldId` is not the current owner - see the stale-blur note above. */
  function blurTextEntry(fieldId: string): void {
    if (current.kind === 'text-entry' && current.fieldId === fieldId) {
      current = CANVAS_OWNER;
    }
  }

  /** Forcible return to the canvas, e.g. when a dialog closes and its fields go with it. */
  function releaseToCanvas(): void {
    current = CANVAS_OWNER;
  }

  function route(
    sample: KeySample,
    dispatcher: KeyboardDispatcher,
    options?: RouteKeyOptions,
  ): InputRouting {
    return routeKeySample(current, sample, dispatcher, options);
  }

  return { owner, focusTextEntry, blurTextEntry, releaseToCanvas, route };
}

/** True while any text entry owns input. Useful for surfaces that suppress hover affordances during entry. */
export function textEntryOwnsInput(owner: InputOwner): boolean {
  return owner.kind === 'text-entry';
}
