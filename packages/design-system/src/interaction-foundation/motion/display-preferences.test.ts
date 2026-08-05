import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_PREFERENCES,
  NON_COLOUR_STATE_CUES,
  colourMayCarryMeaning,
  motionMayCarryMeaning,
  nonColourCuesFor,
  paletteModeFor,
  readDisplayPreferences,
  stateNeedsNonColourCue,
  type DisplayPreferences,
} from './display-preferences';

function preferences(overrides: Partial<DisplayPreferences> = {}): DisplayPreferences {
  return { ...DEFAULT_DISPLAY_PREFERENCES, ...overrides };
}

function matchMediaFor(active: readonly string[]) {
  return (query: string) => ({ matches: active.includes(query) });
}

describe('NON_COLOUR_STATE_CUES', () => {
  it('gives every listed state at least one cue that is not colour', () => {
    // The list is the contract: a state added with an empty cue list fails
    // here, which is the only way this rule survives a redesign.
    const empty = Object.entries(NON_COLOUR_STATE_CUES)
      .filter(([, cues]) => cues.length === 0)
      .map(([state]) => state);

    expect(empty).toEqual([]);
  });

  it('covers the states a CAD interface says with colour and nothing else', () => {
    for (const state of ['selected', 'read-only', 'error', 'hidden', 'ai-proposed']) {
      expect(stateNeedsNonColourCue(state)).toBe(true);
      expect(nonColourCuesFor(state).length).toBeGreaterThan(0);
    }
  });

  it('names no cue for a state nobody registered', () => {
    expect(stateNeedsNonColourCue('invented')).toBe(false);
    expect(nonColourCuesFor('invented')).toEqual([]);
  });
});

describe('paletteModeFor', () => {
  it('hands the palette to the system under forced colours', () => {
    // The page cannot win that argument, and trying produces the worst
    // outcome: half the interface substituted and half not.
    expect(paletteModeFor(preferences({ forcedColors: 'active' }))).toBe('system');
  });

  it('adjusts within the product palette for a contrast preference', () => {
    expect(paletteModeFor(preferences({ contrast: 'more' }))).toBe('product-high-contrast');
  });

  it('lets forced colours win over a contrast preference', () => {
    expect(paletteModeFor(preferences({ forcedColors: 'active', contrast: 'more' }))).toBe(
      'system',
    );
  });

  it('uses the product palette by default', () => {
    expect(paletteModeFor(DEFAULT_DISPLAY_PREFERENCES)).toBe('product');
  });
});

describe('colourMayCarryMeaning', () => {
  it('is false under forced colours', () => {
    // A renderer asking this gets told to reach for the glyph instead of a hue
    // that is about to be replaced.
    expect(colourMayCarryMeaning(preferences({ forcedColors: 'active' }))).toBe(false);
  });

  it('is true otherwise, including under a contrast preference', () => {
    expect(colourMayCarryMeaning(DEFAULT_DISPLAY_PREFERENCES)).toBe(true);
    expect(colourMayCarryMeaning(preferences({ contrast: 'more' }))).toBe(true);
  });
});

describe('motionMayCarryMeaning', () => {
  it('is false when the user asked for reduced motion', () => {
    // Distinct from whether motion may happen: what a reduced-motion user must
    // not get is a transition that is the only indication something changed.
    expect(motionMayCarryMeaning(preferences({ motion: 'reduce' }))).toBe(false);
  });

  it('is true by default', () => {
    expect(motionMayCarryMeaning(DEFAULT_DISPLAY_PREFERENCES)).toBe(true);
  });
});

describe('readDisplayPreferences', () => {
  it('returns the unmodified product when there is no matchMedia', () => {
    // A server render gets the documented default rather than throwing.
    expect(readDisplayPreferences(undefined)).toEqual(DEFAULT_DISPLAY_PREFERENCES);
  });

  it('reads forced colours', () => {
    const read = readDisplayPreferences(matchMediaFor(['(forced-colors: active)']));

    expect(read.forcedColors).toBe('active');
  });

  it('reads both contrast directions', () => {
    expect(readDisplayPreferences(matchMediaFor(['(prefers-contrast: more)'])).contrast).toBe(
      'more',
    );
    expect(readDisplayPreferences(matchMediaFor(['(prefers-contrast: less)'])).contrast).toBe(
      'less',
    );
  });

  it('reads reduced motion', () => {
    expect(readDisplayPreferences(matchMediaFor(['(prefers-reduced-motion: reduce)'])).motion).toBe(
      'reduce',
    );
  });

  it('treats a query the browser cannot answer as no preference', () => {
    // A browser that does not understand a query is not one expressing a
    // preference.
    const throwing = () => {
      throw new Error('unsupported media feature');
    };

    expect(readDisplayPreferences(throwing)).toEqual(DEFAULT_DISPLAY_PREFERENCES);
  });

  it('reads several preferences at once', () => {
    const read = readDisplayPreferences(
      matchMediaFor(['(forced-colors: active)', '(prefers-reduced-motion: reduce)']),
    );

    expect(read).toEqual({ forcedColors: 'active', contrast: 'no-preference', motion: 'reduce' });
  });
});
