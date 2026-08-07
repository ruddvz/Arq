import { describe, expect, it } from 'vitest';
import {
  resolveOpticalQuality,
  type OpticalEnvironment,
  type OpticalQuality,
} from './optical-quality';

/** Everything supported, nothing objected to, nothing failed. */
function capable(requested: OpticalQuality = 'auto'): OpticalEnvironment {
  return {
    requested,
    reducedTransparency: false,
    increasedContrast: false,
    forcedColors: false,
    supportsBackdropFilter: true,
    supportsDisplacementMap: true,
    deterministicCapture: false,
    runtimeFailed: false,
  };
}

describe('resolveOpticalQuality', () => {
  it('gives a capable browser the full material', () => {
    expect(resolveOpticalQuality(capable())).toBe('refraction');
    expect(resolveOpticalQuality(capable('refraction'))).toBe('refraction');
  });

  describe('the user settings, which outrank the product preference', () => {
    /*
     * The ordering is the whole point of this function. A product that ships
     * `requested: 'refraction'` must not be able to override someone who has
     * asked their operating system for less, and there is exactly one place
     * that can be got wrong.
     */
    it('turns everything off for reduced transparency, whatever was asked for', () => {
      for (const requested of ['auto', 'material', 'refraction'] as const) {
        expect(resolveOpticalQuality({ ...capable(requested), reducedTransparency: true })).toBe(
          'off',
        );
      }
    });

    it('turns everything off in forced colours', () => {
      expect(resolveOpticalQuality({ ...capable('refraction'), forcedColors: true })).toBe('off');
    });

    it('turns everything off when more contrast is asked for', () => {
      // A translucent surface lowers the contrast of everything drawn on it, so
      // keeping the blur would answer the opposite of the question.
      expect(resolveOpticalQuality({ ...capable('refraction'), increasedContrast: true })).toBe(
        'off',
      );
    });
  });

  describe('what the browser can actually do', () => {
    it('is off without a backdrop filter, not translucent over nothing', () => {
      // The one genuinely unreadable outcome: a tint with the backdrop
      // unresolved behind it.
      for (const requested of ['auto', 'material', 'refraction'] as const) {
        expect(
          resolveOpticalQuality({ ...capable(requested), supportsBackdropFilter: false }),
        ).toBe('off');
      }
    });

    it('drops to material without a displacement map, not to nothing', () => {
      // The lens is decorative; the surface is not. Losing the lens costs a
      // reader nothing, so the glass stays.
      expect(resolveOpticalQuality({ ...capable(), supportsDisplacementMap: false })).toBe(
        'material',
      );
    });
  });

  describe('the runtime downgrades', () => {
    it('drops to material while a deterministic capture is running', () => {
      // A lens samples what is behind it and is not reproducible frame to
      // frame, so a visual baseline containing one fails for reasons unrelated
      // to the change under test.
      expect(resolveOpticalQuality({ ...capable(), deterministicCapture: true })).toBe('material');
      expect(resolveOpticalQuality({ ...capable('refraction'), deterministicCapture: true })).toBe(
        'material',
      );
    });

    it('drops to material once a lens has failed, and stays there', () => {
      expect(resolveOpticalQuality({ ...capable(), runtimeFailed: true })).toBe('material');
    });

    it('still respects a user setting while downgrading', () => {
      // Both conditions at once: the downgrade must not resurrect a surface
      // reduced transparency already ruled out.
      expect(
        resolveOpticalQuality({
          ...capable(),
          runtimeFailed: true,
          reducedTransparency: true,
        }),
      ).toBe('off');
    });
  });

  it('never returns the request itself, only an outcome', () => {
    // `auto` is a question. A caller that got it back would have to resolve it
    // again, which is the duplication this function exists to prevent.
    const outcomes = (['off', 'material', 'refraction', 'auto'] as const).map((requested) =>
      resolveOpticalQuality(capable(requested)),
    );
    expect(outcomes).not.toContain('auto');
  });
});
