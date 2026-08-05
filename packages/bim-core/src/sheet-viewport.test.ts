import { describe, expect, it } from 'vitest';
import type { ViewId } from './ids';
import {
  ANNOTATION_TEXT_HEIGHTS_PAPER_MM,
  CONVENTIONAL_SCALES,
  VIEWPORT_REJECTIONS,
  annotationHeightInModelUnits,
  checkCropFits,
  isWithinCrop,
  largestFittingScale,
  modelToPaper,
  paperSizeForCrop,
  paperToModel,
  scaleChangesContent,
  withScale,
  type CropRegion,
  type CroppedViewport,
} from './sheet-viewport';

/** A 20m x 15m building, in millimetres. */
const CROP: CropRegion = { minX: 0, minY: 0, maxX: 20_000, maxY: 15_000 };

/** A1 in millimetres. */
const SHEET_WIDTH = 841;
const SHEET_HEIGHT = 594;

function viewport(scale: number, crop: CropRegion = CROP): CroppedViewport {
  return { viewId: 'view-1' as ViewId, scale, position: { x: 20, y: 20 }, crop };
}

/** A viewport with no crop at all, which is not the same as one covering everything. */
function uncroppedViewport(scale: number): CroppedViewport {
  return { viewId: 'view-1' as ViewId, scale, position: { x: 20, y: 20 } };
}

describe('paperSizeForCrop', () => {
  it('says how much paper a crop needs at a scale', () => {
    // 20m at 1:100 is 200mm of paper.
    expect(paperSizeForCrop(CROP, 1 / 100)).toEqual({ width: 200, height: 150 });
  });
});

describe('checkCropFits', () => {
  it('accepts a crop that fits the sheet', () => {
    expect(checkCropFits(CROP, 1 / 100, SHEET_WIDTH, SHEET_HEIGHT)).toBeNull();
  });

  it('rejects a crop that needs more paper than the sheet has', () => {
    // 20m at 1:20 is a metre of paper.
    expect(checkCropFits(CROP, 1 / 20, SHEET_WIDTH, SHEET_HEIGHT)).toBe(
      VIEWPORT_REJECTIONS.cropTooLargeForSheet,
    );
  });

  it('rejects an empty crop', () => {
    expect(
      checkCropFits({ minX: 0, minY: 0, maxX: 0, maxY: 100 }, 1 / 100, SHEET_WIDTH, SHEET_HEIGHT),
    ).toBe(VIEWPORT_REJECTIONS.emptyCrop);
  });

  it('rejects a non-positive scale', () => {
    expect(checkCropFits(CROP, 0, SHEET_WIDTH, SHEET_HEIGHT)).toBe(
      VIEWPORT_REJECTIONS.invalidScale,
    );
  });
});

describe('largestFittingScale', () => {
  it('offers a scale someone would write in a title block', () => {
    // Not 1:137. Drawing scales are conventional numbers for a reason.
    const scale = largestFittingScale(CROP, SHEET_WIDTH, SHEET_HEIGHT);

    expect(scale).not.toBeNull();
    expect(CONVENTIONAL_SCALES).toContain(scale);
    expect(scale).toBe(1 / 50);
  });

  it('returns null when nothing conventional fits', () => {
    const enormous: CropRegion = { minX: 0, minY: 0, maxX: 100_000_000, maxY: 1000 };

    expect(largestFittingScale(enormous, SHEET_WIDTH, SHEET_HEIGHT)).toBeNull();
  });
});

describe('modelToPaper and paperToModel', () => {
  it('places the crop corner at the viewport position', () => {
    expect(modelToPaper({ x: 0, y: 0 }, viewport(1 / 100))).toEqual({ x: 20, y: 20 });
  });

  it('scales a model offset onto the page', () => {
    // 5m at 1:100 is 50mm of paper, from the viewport origin.
    expect(modelToPaper({ x: 5000, y: 0 }, viewport(1 / 100))).toEqual({ x: 70, y: 20 });
  });

  it('round-trips, so a click on a printed layout reaches the element it landed on', () => {
    const point = { x: 12_345, y: 6789 };
    const round = paperToModel(modelToPaper(point, viewport(1 / 100)), viewport(1 / 100));

    expect(round.x).toBeCloseTo(point.x, 6);
    expect(round.y).toBeCloseTo(point.y, 6);
  });
});

describe('isWithinCrop', () => {
  it('excludes a point outside the crop', () => {
    expect(isWithinCrop({ x: 25_000, y: 0 }, viewport(1 / 100))).toBe(false);
    expect(isWithinCrop({ x: 10_000, y: 7000 }, viewport(1 / 100))).toBe(true);
  });

  it('includes everything when there is no crop', () => {
    // An absent crop follows the model as it grows; a crop that happens to
    // cover everything does not.
    expect(isWithinCrop({ x: 9_000_000, y: 0 }, uncroppedViewport(1 / 100))).toBe(true);
  });

  it('includes a point exactly on the boundary', () => {
    expect(isWithinCrop({ x: 20_000, y: 15_000 }, viewport(1 / 100))).toBe(true);
  });
});

describe('scale and crop are independent', () => {
  it('does not change what the drawing contains when the scale changes', () => {
    // An architect who crops to the east wing and changes 1:100 to 1:200 wants
    // a smaller drawing, not a west wing.
    const inside = { x: 19_000, y: 14_000 };
    const outside = { x: 25_000, y: 14_000 };

    for (const scale of [1 / 50, 1 / 100, 1 / 200]) {
      expect(isWithinCrop(inside, viewport(scale))).toBe(true);
      expect(isWithinCrop(outside, viewport(scale))).toBe(false);
    }
  });

  it('states the rule in code', () => {
    // A change making the crop paper-relative would have to delete this and
    // its test.
    expect(scaleChangesContent()).toBe(false);
    expect(scaleChangesContent.length).toBe(0);
  });
});

describe('annotationHeightInModelUnits', () => {
  it('keeps text the same physical size on paper at every scale', () => {
    // Both are read by a person holding the same sheet.
    const atDetail = annotationHeightInModelUnits('normal', 1 / 20);
    const atPlan = annotationHeightInModelUnits('normal', 1 / 200);

    expect(atDetail * (1 / 20)).toBeCloseTo(ANNOTATION_TEXT_HEIGHTS_PAPER_MM.normal, 10);
    expect(atPlan * (1 / 200)).toBeCloseTo(ANNOTATION_TEXT_HEIGHTS_PAPER_MM.normal, 10);
  });

  it('needs a bigger model height at a smaller scale', () => {
    // At 1:200 a 2.5mm label is 500 model-millimetres; at 1:20 it is 50. A
    // renderer using one number for both makes one of them unusable.
    expect(annotationHeightInModelUnits('normal', 1 / 200)).toBe(500);
    expect(annotationHeightInModelUnits('normal', 1 / 20)).toBe(50);
  });

  it('offers the heights a drawing office uses', () => {
    expect(ANNOTATION_TEXT_HEIGHTS_PAPER_MM.normal).toBe(2.5);
    expect(Object.values(ANNOTATION_TEXT_HEIGHTS_PAPER_MM).every((height) => height < 10)).toBe(
      true,
    );
  });
});

describe('withScale', () => {
  it('rescales a viewport that still fits', () => {
    expect(withScale(viewport(1 / 100), 1 / 200, SHEET_WIDTH, SHEET_HEIGHT)?.scale).toBe(1 / 200);
  });

  it('keeps the crop', () => {
    expect(withScale(viewport(1 / 100), 1 / 200, SHEET_WIDTH, SHEET_HEIGHT)?.crop).toEqual(CROP);
  });

  it('refuses a scale that no longer fits rather than cropping to compensate', () => {
    // Quietly shrinking the crop drops part of the drawing at the moment the
    // user was trying to make it fit, and they find out at the printer.
    expect(withScale(viewport(1 / 100), 1 / 20, SHEET_WIDTH, SHEET_HEIGHT)).toBeNull();
  });

  it('refuses a non-positive scale', () => {
    expect(withScale(viewport(1 / 100), 0, SHEET_WIDTH, SHEET_HEIGHT)).toBeNull();
    expect(withScale(viewport(1 / 100), Number.NaN, SHEET_WIDTH, SHEET_HEIGHT)).toBeNull();
  });

  it('allows any positive scale on an uncropped viewport', () => {
    expect(withScale(uncroppedViewport(1 / 100), 1 / 5, SHEET_WIDTH, SHEET_HEIGHT)?.scale).toBe(
      1 / 5,
    );
  });
});
