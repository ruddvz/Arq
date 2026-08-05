/**
 * V3-150: long names, and dialogs that still work at the far end of both axes.
 *
 * Project names in practice are not short and are not distinguished at the
 * front. "Riverside Mixed Use - Phase 2 - Planning - REV C" and the same string
 * ending REV D differ in the last character, so end-truncation renders them
 * identical and a user picks the wrong file from a list of things that all read
 * "Riverside Mixed Use - Phase 2 - Plann…". Middle truncation keeps both ends
 * and is the only form that preserves what makes names different.
 *
 * The full name always stays in the accessible name. A truncation is a visual
 * accommodation, and removing information from a screen reader to save space it
 * does not have is a straightforward loss.
 *
 * The second half is the multiplication nobody tests. A dialog is checked at
 * the smallest viewport, and separately at 200% text, and passes both - while
 * the case that breaks is both at once, which is a real configuration for
 * someone using a phone with large type. `dialogFits` takes the two together
 * because that is the only way the product of them gets checked.
 */

/** A truncation that says what it dropped, so a caller can put the whole string somewhere reachable. */
export interface FittedText {
  readonly display: string;
  /** Always the original. A truncation never reaches the accessible name. */
  readonly accessibleName: string;
  readonly truncated: boolean;
}

/** Below this there is no room for both ends and an ellipsis, so a head truncation is all that fits. */
export const MIN_MIDDLE_TRUNCATION_LENGTH = 8;

/**
 * Truncates in the middle, keeping both ends.
 *
 * The tail is favoured when the budget is odd, because that is where revisions,
 * phases and drawing numbers live - the parts that distinguish one name from
 * the next.
 */
export function fitTextMiddle(text: string, maxLength: number): FittedText {
  if (maxLength <= 0) {
    return { display: '', accessibleName: text, truncated: text.length > 0 };
  }
  if (text.length <= maxLength) {
    return { display: text, accessibleName: text, truncated: false };
  }
  if (maxLength < MIN_MIDDLE_TRUNCATION_LENGTH) {
    return { display: `${text.slice(0, maxLength - 1)}…`, accessibleName: text, truncated: true };
  }

  const budget = maxLength - 1;
  const head = Math.floor(budget / 2);
  const tail = budget - head;
  return {
    display: `${text.slice(0, head)}…${text.slice(text.length - tail)}`,
    accessibleName: text,
    truncated: true,
  };
}

/**
 * Truncates at the end.
 *
 * For text whose beginning carries the meaning - a message, a description. Kept
 * separate rather than made an option, so choosing the wrong one for a name is
 * a visible decision at the call site rather than a default nobody revisited.
 */
export function fitTextEnd(text: string, maxLength: number): FittedText {
  if (maxLength <= 0) {
    return { display: '', accessibleName: text, truncated: text.length > 0 };
  }
  if (text.length <= maxLength) {
    return { display: text, accessibleName: text, truncated: false };
  }
  return { display: `${text.slice(0, maxLength - 1)}…`, accessibleName: text, truncated: true };
}

/** The smallest viewport the product supports, in CSS pixels. */
export const MIN_SUPPORTED_VIEWPORT = { widthPx: 320, heightPx: 568 } as const;

/** The largest text scaling the product supports. 200% is the WCAG resize requirement. */
export const MAX_SUPPORTED_TEXT_SCALE = 2;

export interface DialogRequirements {
  /** Intrinsic width the dialog's content needs at 100% text, in CSS pixels. */
  readonly contentWidthPx: number;
  readonly contentHeightPx: number;
  /** How much of the height scales with text. Chrome - padding, borders - does not. */
  readonly textDrivenHeightFraction: number;
}

export interface DialogFitResult {
  readonly fits: boolean;
  readonly requiredWidthPx: number;
  readonly requiredHeightPx: number;
  /**
   * Whether the dialog must scroll its body to fit. Scrolling is an acceptable
   * answer and a dialog that silently clips is not, so a caller that gets
   * `fits: true` with `needsBodyScroll: true` still has something to implement.
   */
  readonly needsBodyScroll: boolean;
}

/**
 * Checks a dialog against the smallest viewport and the largest text scale at
 * the same time.
 *
 * Both together, because each alone passes for dialogs that break when
 * combined - a phone with large type is a real configuration and the one that
 * is never tested.
 *
 * Height overflow is reported as needing a scrolling body rather than as a
 * failure: a tall dialog that scrolls is usable, and one that is clipped is
 * not. Width overflow is a failure, because horizontal scrolling inside a
 * dialog is not something anyone recovers from.
 */
export function dialogFits(
  requirements: DialogRequirements,
  viewport: { readonly widthPx: number; readonly heightPx: number } = MIN_SUPPORTED_VIEWPORT,
  textScale: number = MAX_SUPPORTED_TEXT_SCALE,
): DialogFitResult {
  const fixedFraction = 1 - requirements.textDrivenHeightFraction;
  const requiredHeightPx =
    requirements.contentHeightPx * fixedFraction +
    requirements.contentHeightPx * requirements.textDrivenHeightFraction * textScale;

  // Width scales with text too: a label that wraps is a label that got taller,
  // and one that cannot wrap is a dialog that got wider.
  const requiredWidthPx = requirements.contentWidthPx * textScale;

  return {
    fits: requiredWidthPx <= viewport.widthPx,
    requiredWidthPx,
    requiredHeightPx,
    needsBodyScroll: requiredHeightPx > viewport.heightPx,
  };
}

/**
 * Text that must never be truncated, whatever the space.
 *
 * A refusal reason, a destructive confirmation, a scope request: shortening any
 * of these produces a sentence that reads as complete and says something else.
 * A surface with no room for one must find room - by wrapping, by growing, by
 * scrolling - rather than by cutting.
 */
export const NEVER_TRUNCATED_ROLES = [
  'refusal-reason',
  'destructive-confirmation',
  'permission-request',
  'validation-error',
  'disabled-reason',
] as const;

export type TextRole = (typeof NEVER_TRUNCATED_ROLES)[number];

export function mayTruncate(role: string): boolean {
  return !(NEVER_TRUNCATED_ROLES as readonly string[]).includes(role);
}
