import { describe, expect, it } from 'vitest';
import {
  MAX_SUPPORTED_TEXT_SCALE,
  MIN_SUPPORTED_VIEWPORT,
  NEVER_TRUNCATED_ROLES,
  dialogFits,
  fitTextEnd,
  fitTextMiddle,
  mayTruncate,
} from './text-fitting';

const REV_C = 'Riverside Mixed Use - Phase 2 - Planning - REV C';
const REV_D = 'Riverside Mixed Use - Phase 2 - Planning - REV D';

describe('fitTextMiddle', () => {
  it('keeps two near-identical names distinguishable', () => {
    // End truncation renders both as "Riverside Mixed Use - Phase 2 - Plann…"
    // and the user picks the wrong file.
    expect(fitTextMiddle(REV_C, 24).display).not.toBe(fitTextMiddle(REV_D, 24).display);
  });

  it('leaves a short name alone', () => {
    expect(fitTextMiddle('Site plan', 24)).toEqual({
      display: 'Site plan',
      accessibleName: 'Site plan',
      truncated: false,
    });
  });

  it('keeps the whole name in the accessible name', () => {
    // Removing information from a screen reader to save space it does not have
    // is a straightforward loss.
    const fitted = fitTextMiddle(REV_C, 24);

    expect(fitted.truncated).toBe(true);
    expect(fitted.accessibleName).toBe(REV_C);
    expect(fitted.display.length).toBeLessThanOrEqual(24);
  });

  it('favours the tail, where revisions and drawing numbers live', () => {
    const fitted = fitTextMiddle(REV_C, 15);

    expect(fitted.display.endsWith('REV C')).toBe(true);
  });

  it('falls back to a head truncation when there is no room for both ends', () => {
    expect(fitTextMiddle(REV_C, 5).display).toBe('Rive…');
  });

  it('handles a zero budget without inventing characters', () => {
    expect(fitTextMiddle(REV_C, 0)).toEqual({
      display: '',
      accessibleName: REV_C,
      truncated: true,
    });
  });
});

describe('fitTextEnd', () => {
  it('truncates at the end for text whose beginning carries the meaning', () => {
    expect(fitTextEnd('This wall could not be created because', 12).display).toBe('This wall c…');
  });

  it('is a separate function, so choosing it for a name is a visible decision', () => {
    expect(fitTextEnd(REV_C, 24).display.endsWith('…')).toBe(true);
    expect(fitTextEnd(REV_C, 24).accessibleName).toBe(REV_C);
  });
});

describe('dialogFits', () => {
  // 150px at 200% text is 300px, inside the 320px minimum viewport, so width
  // is not what these height cases are testing.
  const dialog = { contentWidthPx: 150, contentHeightPx: 400, textDrivenHeightFraction: 0.6 };

  it('checks the smallest viewport and the largest text scale together', () => {
    // Each alone passes for dialogs that break combined, and a phone with large
    // type is a real configuration.
    expect(dialogFits({ ...dialog, contentWidthPx: 300 }, MIN_SUPPORTED_VIEWPORT, 1).fits).toBe(
      true,
    );
    expect(dialogFits({ ...dialog, contentWidthPx: 300 }).fits).toBe(false);
  });

  it('fails on width, because horizontal scrolling in a dialog is unrecoverable', () => {
    const result = dialogFits({ ...dialog, contentWidthPx: 300 });

    expect(result.fits).toBe(false);
    expect(result.requiredWidthPx).toBe(600);
  });

  it('reports height overflow as needing a scrolling body rather than as a failure', () => {
    // A tall dialog that scrolls is usable; one that is clipped is not.
    const result = dialogFits({ ...dialog, contentHeightPx: 500 });

    expect(result.fits).toBe(true);
    expect(result.needsBodyScroll).toBe(true);
  });

  it('scales only the text-driven part of the height', () => {
    // Padding and borders do not grow with type size.
    const result = dialogFits(
      { contentWidthPx: 100, contentHeightPx: 100, textDrivenHeightFraction: 0.5 },
      MIN_SUPPORTED_VIEWPORT,
      2,
    );

    expect(result.requiredHeightPx).toBe(150);
  });

  it('fits a dialog designed for the far end of both axes', () => {
    const result = dialogFits({
      contentWidthPx: 150,
      contentHeightPx: 200,
      textDrivenHeightFraction: 0.5,
    });

    expect(result.fits).toBe(true);
    expect(result.needsBodyScroll).toBe(false);
  });

  it('uses the supported minimum and maximum by default', () => {
    expect(MIN_SUPPORTED_VIEWPORT.widthPx).toBe(320);
    expect(MAX_SUPPORTED_TEXT_SCALE).toBe(2);
  });
});

describe('mayTruncate', () => {
  it('refuses to shorten text that would read as complete and say something else', () => {
    for (const role of NEVER_TRUNCATED_ROLES) {
      expect(mayTruncate(role)).toBe(false);
    }
  });

  it('allows truncating an ordinary label', () => {
    expect(mayTruncate('project-name')).toBe(true);
  });
});
