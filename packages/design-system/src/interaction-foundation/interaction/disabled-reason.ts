/**
 * V3-146 / AC3-081's neighbour: a disabled control has to say why it is
 * disabled, to everyone.
 *
 * `tool-rail-adapter.ts` already carries a `disabledReason` per entry, and the
 * reason is already good. What it does not have is a way to reach anyone using
 * a screen reader, because the obvious rendering breaks it: the `disabled`
 * attribute removes an element from the tab order entirely. A keyboard user
 * tabs straight past the greyed-out button and never learns it exists, let
 * alone why it cannot be used, and the only remaining route to the answer is
 * hovering a tooltip with a pointer they may not have.
 *
 * `aria-disabled="true"` is the alternative and it is not a cosmetic swap. The
 * control stays focusable and announced, so the reason can be attached to it
 * and read, and the cost is that the browser no longer suppresses activation -
 * which now has to be suppressed deliberately, in the handler. That is a real
 * obligation, so this module returns both halves together: the attributes to
 * render and the fact that activation must be blocked, rather than leaving a
 * caller to remember the second one.
 *
 * The distinction between the two forms is kept rather than collapsed. A
 * control that is disabled because a *reason exists* uses aria-disabled and
 * stays reachable. A control with no reason to give - one that is genuinely
 * inert, in a hidden panel or a closed dialog - keeps the native attribute,
 * because making something focusable to announce nothing is worse than
 * skipping it.
 */

export interface DisabledStateInput {
  readonly disabled: boolean;
  /** Why, in the user's terms. Null when there is nothing to say. */
  readonly reason: string | null;
  /** Id of the element that will render the reason text, for aria-describedby. */
  readonly reasonElementId?: string;
}

export interface DisabledStateAttributes {
  /** Set only for the inert form. A control with a reason must not carry this. */
  readonly disabled?: true;
  readonly 'aria-disabled'?: true;
  readonly 'aria-describedby'?: string;
  /** -1 keeps it out of the tab order; 0 or undefined leaves the natural order. */
  readonly tabIndex?: -1;
}

export interface DisabledStateDescription {
  readonly attributes: DisabledStateAttributes;
  /**
   * True when the browser will no longer block activation for you. A caller
   * that ignores this ships a button that looks disabled and works.
   */
  readonly mustSuppressActivation: boolean;
  /** The text to render in the element `reasonElementId` names, or null. */
  readonly reasonText: string | null;
}

/**
 * Describes how to render a disabled control.
 *
 * Requires `reasonElementId` whenever there is a reason. A reason with nothing
 * pointing at it is a reason nobody hears, and defaulting to a generated id
 * would produce an aria-describedby aimed at an element the caller never
 * renders - which reads to a screen reader as no description at all, silently.
 */
export function describeDisabledState(input: DisabledStateInput): DisabledStateDescription {
  if (!input.disabled) {
    return { attributes: {}, mustSuppressActivation: false, reasonText: null };
  }

  if (input.reason === null || input.reason.trim().length === 0) {
    // Genuinely inert: nothing to announce, so the native attribute is right
    // and skipping it in the tab order costs the user nothing.
    return {
      attributes: { disabled: true },
      mustSuppressActivation: false,
      reasonText: null,
    };
  }

  if (input.reasonElementId === undefined) {
    throw new Error('a disabled control with a reason must name the element that renders it');
  }

  return {
    attributes: {
      'aria-disabled': true,
      'aria-describedby': input.reasonElementId,
    },
    // The browser stopped doing this for us the moment we chose aria-disabled.
    mustSuppressActivation: true,
    reasonText: input.reason,
  };
}

/**
 * Whether an activation attempt should be ignored.
 *
 * Called from the handler, not from the render. The point of aria-disabled is
 * that the control still receives events; this is what makes receiving them
 * harmless.
 */
export function shouldIgnoreActivation(description: DisabledStateDescription): boolean {
  return description.mustSuppressActivation;
}

/**
 * Reason text for a control that is unavailable because the project is open
 * read-only.
 *
 * Phrased as a state of the project rather than of the button. "Editing is
 * disabled" tells a user their software is broken; "This project is open for
 * reading only" tells them what is true and implies what would change it.
 */
export function readOnlyDisabledReason(detail?: string): string {
  return detail === undefined
    ? 'This project is open for reading only.'
    : `This project is open for reading only. ${detail}`;
}
