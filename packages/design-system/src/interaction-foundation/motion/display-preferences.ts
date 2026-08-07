/**
 * V3-151: reduced motion is handled; forced colours and contrast are not.
 *
 * `transitions.ts` already takes a `reducedMotion` flag, and the CSS already
 * honours `prefers-reduced-motion`. Nothing anywhere reads `forced-colors` or
 * `prefers-contrast`, and for a drawing tool that gap is larger than it is for
 * most applications, because a CAD interface says a great deal with colour that
 * it says nowhere else.
 *
 * Windows High Contrast (`forced-colors: active`) replaces every colour the
 * page specifies with a small system palette. It is not a theme - the
 * substitution is not negotiable - and the failure it produces in a drawing
 * tool is specific: selection, hover, warning and error states that were
 * distinguished only by colour all collapse into the same system colour, and a
 * user who could previously see which wall was selected now cannot.
 *
 * The rule that follows is the one worth encoding: **no state may be carried by
 * colour alone.** That is already a WCAG requirement and it is routinely met
 * with a hover-only cursor change or a tooltip, which forced colours does not
 * help with either. `stateNeedsNonColourCue` names the states that must carry a
 * second signal, and the test asserts the list is not empty for any of them,
 * so a new state cannot be added colour-only without something failing.
 *
 * `prefers-contrast: more` is a different request and gets a different answer:
 * it is a preference, so it adjusts within the product's own palette rather
 * than replacing it.
 */

export type ForcedColorsMode = 'none' | 'active';
export type ContrastPreference = 'no-preference' | 'more' | 'less';
export type MotionPreference = 'no-preference' | 'reduce';
export type TransparencyPreference = 'no-preference' | 'reduce';

export interface DisplayPreferences {
  readonly forcedColors: ForcedColorsMode;
  readonly contrast: ContrastPreference;
  readonly motion: MotionPreference;
  /**
   * `prefers-reduced-transparency`. The fourth axis, and the one this module
   * was missing: the other three describe how colour and movement may be used,
   * and none of them answers whether a surface may let the content behind it
   * show through. A user who asks for reduced transparency is asking about
   * exactly that, and the request is not covered by the contrast preference -
   * translucency and contrast are separate complaints with separate remedies.
   */
  readonly transparency: TransparencyPreference;
}

/** What a browser that reports nothing gets. Every preference defaults to the unmodified product. */
export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  forcedColors: 'none',
  contrast: 'no-preference',
  motion: 'no-preference',
  transparency: 'no-preference',
};

/**
 * States that must be distinguishable without colour.
 *
 * Each carries at least one non-colour cue. The list is the contract: a state
 * added here with an empty cue list fails the test, which is the only way this
 * rule survives contact with a redesign.
 */
export const NON_COLOUR_STATE_CUES: Readonly<Record<string, readonly string[]>> = {
  selected: ['a drawn selection outline', 'selection handles'],
  hovered: ['an outline weight change'],
  'read-only': ['a lock glyph', 'the read-only label in the top bar'],
  warning: ['a warning glyph', 'the message text'],
  error: ['an error glyph', 'the message text'],
  hidden: ['reduced line weight', 'the eye-off glyph in the model tree'],
  'clipped-by-section-box': ['the cut-face pattern', 'the section box outline'],
  'element-outside-crop': ['absence from the viewport frame'],
  'ai-proposed': ['a dashed outline', 'the proposal badge'],
  'validation-blocking': ['a glyph in the row', 'the blocking message'],
};

export function stateNeedsNonColourCue(state: string): boolean {
  return Object.prototype.hasOwnProperty.call(NON_COLOUR_STATE_CUES, state);
}

export function nonColourCuesFor(state: string): readonly string[] {
  return NON_COLOUR_STATE_CUES[state] ?? [];
}

/**
 * How the product should treat its own palette.
 *
 * `system` means stop specifying colours and let the platform substitute; the
 * page cannot win that argument and trying produces the worst outcome, where
 * half the interface is substituted and half is not.
 */
export type PaletteMode = 'product' | 'product-high-contrast' | 'system';

export function paletteModeFor(preferences: DisplayPreferences): PaletteMode {
  if (preferences.forcedColors === 'active') {
    return 'system';
  }
  return preferences.contrast === 'more' ? 'product-high-contrast' : 'product';
}

/**
 * Whether decorative colour may carry any meaning at all.
 *
 * False under forced colours, and that is the point: a renderer asking this
 * before drawing a state gets told to reach for the glyph or the outline
 * instead of a hue that is about to be replaced.
 */
export function colourMayCarryMeaning(preferences: DisplayPreferences): boolean {
  return preferences.forcedColors !== 'active';
}

/**
 * Whether motion may be used to communicate.
 *
 * Distinct from whether motion may happen at all. A reduced-motion user still
 * gets state changes; what they do not get is a transition that is the only
 * indication something changed. `arqControlTransition` already shortens
 * durations - this answers the prior question of whether the movement was
 * carrying information that now needs somewhere else to live.
 */
export function motionMayCarryMeaning(preferences: DisplayPreferences): boolean {
  return preferences.motion !== 'reduce';
}

/**
 * Whether a control-layer surface may be translucent.
 *
 * Three independent reasons make this false, each sufficient on its own:
 *
 * - the user asked for reduced transparency, which is the direct request;
 * - forced colours, because the substitution replaces the tint anyway and
 *   leaves only the cost - a blur that buys nothing and still occupies the GPU;
 * - a more-contrast request, because a translucent surface lowers the contrast
 *   of everything drawn on it by definition, which is the opposite of what was
 *   asked for.
 *
 * This answers the accessibility question only. Whether ARQ uses translucent
 * material *at all* is a separate product question, and blueprint section 14
 * currently answers it no - see `appearance-policy.ts`. A caller needs both
 * answers to be yes; this one is not permission on its own.
 */
export function materialMayUseTransparency(preferences: DisplayPreferences): boolean {
  return (
    preferences.transparency !== 'reduce' &&
    preferences.forcedColors !== 'active' &&
    preferences.contrast !== 'more'
  );
}

/**
 * Reads the preferences from a matchMedia-like function.
 *
 * Injected rather than reaching for `window`, so this is testable and so a
 * server render gets the documented default instead of throwing.
 */
export function readDisplayPreferences(
  matchMedia: ((query: string) => { readonly matches: boolean }) | undefined,
): DisplayPreferences {
  if (matchMedia === undefined) {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
  const matches = (query: string): boolean => {
    try {
      return matchMedia(query).matches;
    } catch {
      // A browser that does not understand a query is not a browser expressing
      // a preference. Defaulting to the unmodified product is the safe read.
      return false;
    }
  };

  return {
    forcedColors: matches('(forced-colors: active)') ? 'active' : 'none',
    contrast: matches('(prefers-contrast: more)')
      ? 'more'
      : matches('(prefers-contrast: less)')
        ? 'less'
        : 'no-preference',
    motion: matches('(prefers-reduced-motion: reduce)') ? 'reduce' : 'no-preference',
    // Browsers that predate `prefers-reduced-transparency` report no match
    // rather than throwing, which reads as 'no-preference' - the same answer a
    // user who expressed no preference gets. That is the correct default here
    // and not a silent failure: the product's surfaces are opaque anyway (see
    // appearance-policy.ts), so an unread preference changes nothing today.
    transparency: matches('(prefers-reduced-transparency: reduce)') ? 'reduce' : 'no-preference',
  };
}
