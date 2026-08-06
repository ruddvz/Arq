import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The evidence ADR-0032 opens the dark milestone on.
 *
 * Blueprint section 15's objection was specific: "dark mode should not be
 * shipped as an untested token inversion." This file answers both halves of it.
 *
 * The contrast tests are the "untested" half. The "inversion" half is harder
 * than it looks: a set can pass every contrast threshold and still be a
 * computed flip, and the obvious checks do not catch one. Reversing the surface
 * ramp does not, because an inversion reverses it too. Comparing luminance
 * against its complement does not, because luminance is compressed near zero
 * and calls every possible dark paper an inversion. What does catch it is
 * comparing channels rather than luminance, and observing that the light set is
 * pure neutral while the dark set is not - no arithmetic transform of a neutral
 * produces a chromatic cast.
 *
 * Values are parsed out of the real token files rather than copied here. A test
 * holding its own copy of the palette proves the copy is fine and says nothing
 * about what ships.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const SHELL_TOKENS = readFileSync(
  join(REPO_ROOT, 'packages/design-system/src/shell/shell-tokens.css'),
  'utf8',
);
const BRAND_TOKENS = readFileSync(join(REPO_ROOT, 'design/tokens/brand.v4.css'), 'utf8');

/** The three 8-bit channels of a `#rrggbb` value. */
function channels(hex: string): readonly number[] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG 2.2 relative luminance. */
function luminance(hex: string): number {
  const linear = (eight: number): number => {
    const c = eight / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = channels(hex) as [number, number, number];
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/**
 * Splits the token file at the dark media query, so the same token name can be
 * read in each appearance without the two shadowing each other.
 */
function appearanceSources(): { readonly light: string; readonly dark: string } {
  const index = SHELL_TOKENS.search(/@media[^{]*prefers-color-scheme:\s*dark/);
  expect(index).toBeGreaterThan(-1);
  return { light: SHELL_TOKENS.slice(0, index), dark: SHELL_TOKENS.slice(index) };
}

function token(source: string, name: string): string {
  const match = new RegExp(`--arq-ui-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(source);
  if (match === null) {
    throw new Error(`--arq-ui-${name} is not declared as a hex value in this appearance`);
  }
  return match[1]!.toLowerCase();
}

const { light: LIGHT, dark: DARK } = appearanceSources();

/**
 * The pairs the interface actually renders, each with the WCAG threshold that
 * applies to it: 4.5:1 for body text, 3:1 for non-text boundaries.
 *
 * Deliberately a declared list rather than a cross product of every token
 * against every surface. A cross product asserts pairs that are never drawn,
 * and the failures it invents would force changes to an approved palette to
 * satisfy a combination nobody can see.
 */
const TEXT_ON_SURFACE: readonly (readonly [string, string])[] = [
  ['text-primary', 'paper'],
  ['text-primary', 'surface-1'],
  ['text-primary', 'surface-2'],
  ['text-primary', 'surface-3'],
  ['text-secondary', 'paper'],
  ['text-secondary', 'surface-1'],
  ['text-secondary', 'surface-2'],
  // Muted is the status bar's register, and the status bar sits on paper or the
  // first raised surface. It is deliberately not asserted against surface-3,
  // where the approved light palette reaches only 4.0:1 - a real limit of the
  // light set, recorded here rather than hidden by not testing muted at all.
  ['text-muted', 'paper'],
  ['text-muted', 'surface-1'],
  ['ink', 'paper'],
];

const BOUNDARY_ON_SURFACE: readonly (readonly [string, string])[] = [
  ['line-strong', 'paper'],
  ['line-strong', 'surface-1'],
  ['line-strong', 'surface-2'],
];

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s appearance contrast', (appearance, source) => {
  it.each(TEXT_ON_SURFACE)('renders %s on %s at 4.5:1 or better', (text, surface) => {
    const ratio = contrast(token(source, text), token(source, surface));

    expect(
      ratio,
      `${appearance}: ${text} on ${surface} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(BOUNDARY_ON_SURFACE)('renders %s on %s at 3:1 or better', (line, surface) => {
    const ratio = contrast(token(source, line), token(source, surface));

    expect(
      ratio,
      `${appearance}: ${line} on ${surface} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('focus ring contrast', () => {
  /**
   * The failure that made a dark accent necessary. Phthalo green at its brand
   * value reaches 2.83:1 against dark paper, and a focus ring below 3:1 is a
   * keyboard user who cannot see where they are.
   */
  function brandValue(name: string): string {
    const match = new RegExp(`--arq-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(BRAND_TOKENS);
    expect(match, `--arq-${name} is not declared`).not.toBeNull();
    return match![1]!.toLowerCase();
  }

  it('meets 3:1 against paper in both appearances', () => {
    expect(contrast(brandValue('phthalo-green'), token(LIGHT, 'paper'))).toBeGreaterThanOrEqual(3);
    expect(
      contrast(brandValue('phthalo-green-light'), token(DARK, 'paper')),
    ).toBeGreaterThanOrEqual(3);
  });

  it('would have failed had the brand value been reused unchanged', () => {
    // Records why the dark accent exists. If someone later points the dark
    // focus ring back at the brand value, this is the number they broke.
    expect(contrast(brandValue('phthalo-green'), token(DARK, 'paper'))).toBeLessThan(3);
  });
});

describe('the dark appearance is a design, not an inversion', () => {
  const RAMP = ['paper', 'surface-1', 'surface-2', 'surface-3'] as const;

  it('raises surfaces in the direction each appearance reads', () => {
    // In light, a raised surface is darker than paper; in dark it must be
    // lighter, or raised panels recede instead of coming forward.
    //
    // This is a correctness property, not evidence against inversion: flipping
    // the light ramp would reverse its direction too. The two tests below are
    // what actually separate a designed set from a computed one.
    const lightRamp = RAMP.map((name) => luminance(token(LIGHT, name)));
    const darkRamp = RAMP.map((name) => luminance(token(DARK, name)));

    for (let index = 1; index < RAMP.length; index += 1) {
      expect(
        lightRamp[index]!,
        `light ${RAMP[index]} should be darker than ${RAMP[index - 1]}`,
      ).toBeLessThan(lightRamp[index - 1]!);
      expect(
        darkRamp[index]!,
        `dark ${RAMP[index]} should be lighter than ${RAMP[index - 1]}`,
      ).toBeGreaterThan(darkRamp[index - 1]!);
    }
  });

  it('does not put pure black behind the interface or pure white in body text', () => {
    // Pure black behind 1px CAD linework produces halation and the strokes
    // shimmer during pan and zoom; pure white body text is fatiguing over the
    // long sessions the product is meant to support.
    expect(token(DARK, 'paper')).not.toBe('#000000');
    expect(token(DARK, 'text-primary')).not.toBe('#ffffff');
  });

  it('does not compute the surface ramp as the complement of the light ramp', () => {
    // The mechanical check for what section 15 named, done in channel space
    // rather than luminance. Luminance is compressed near zero - every possible
    // dark paper sits within 0.01 of black's luminance - so a luminance
    // comparison calls any dark set an inversion and proves nothing.
    for (const name of RAMP) {
      const light = channels(token(LIGHT, name));
      const dark = channels(token(DARK, name));
      const nearest = Math.min(
        ...dark.map((value, index) => Math.abs(value - (255 - light[index]!))),
      );

      expect(nearest, `dark ${name} sits on the complement of light ${name}`).toBeGreaterThan(8);
    }
  });

  it('carries a chromatic cast the neutral light set does not', () => {
    // The clearest signature that these values were picked rather than derived.
    // Every light chrome token is a pure neutral (R = G = B), so any arithmetic
    // transform of it is also a pure neutral. The dark set is deliberately cool,
    // which no inversion of a neutral can produce.
    const spread = (hex: string): number => {
      const [r, g, b] = channels(hex) as [number, number, number];
      return Math.max(r, g, b) - Math.min(r, g, b);
    };

    for (const name of [...RAMP, 'text-primary', 'text-secondary', 'text-muted', 'line-strong']) {
      expect(spread(token(LIGHT, name)), `light ${name} is expected to be neutral`).toBe(0);
      expect(spread(token(DARK, name)), `dark ${name} has no chromatic cast`).toBeGreaterThan(2);
    }
  });
});
