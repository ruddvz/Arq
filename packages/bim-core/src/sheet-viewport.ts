import type { SheetPoint, SheetViewport } from './sheet';

/**
 * V3-131: viewport scale and crop. V3-132: annotation that does not scale with
 * the drawing.
 *
 * `sheet.ts` gives a viewport a scale and a position on the page. What it does
 * not say is where the crop lives, and the answer decides whether changing a
 * drawing's scale changes what is in it.
 *
 * A crop defined in paper space - "this 200mm square of the page" - shows more
 * of the building as the scale gets smaller, because the same page area covers
 * more model. That is what a zoom does, and it is not what a crop means. An
 * architect crops a plan to the east wing and then changes 1:100 to 1:200 to
 * fit the sheet; the drawing should get smaller, not grow a west wing. So the
 * crop is a model-space region, and the scale decides how much paper it needs.
 *
 * The second half is the one every drafting tool has to get right and no data
 * model states: annotation does not scale with the drawing. Text on a 1:200
 * plan and text on a 1:20 detail print at the same physical height, because
 * both are read by a person holding the same sheet. A dimension's *value*
 * comes from the model and changes with the geometry; its *text* is 2.5mm on
 * paper whatever the scale. Storing annotation height in model units would make
 * a detail's labels microscopic and a site plan's labels the size of a building,
 * and the mistake is invisible on screen and obvious on paper.
 */

/** A rectangle in model space, in the project's own units. */
export interface CropRegion {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface CroppedViewport extends SheetViewport {
  /**
   * What the viewport shows, in model space. Absent means the whole view, which
   * is different from a crop that happens to cover everything: the first
   * follows the model as it grows, the second does not.
   */
  readonly crop?: CropRegion;
}

export const VIEWPORT_REJECTIONS = {
  invalidScale: 'ARQ_VIEWPORT_INVALID_SCALE',
  emptyCrop: 'ARQ_VIEWPORT_EMPTY_CROP',
  cropTooLargeForSheet: 'ARQ_VIEWPORT_CROP_EXCEEDS_SHEET',
} as const;

export type ViewportRejection = (typeof VIEWPORT_REJECTIONS)[keyof typeof VIEWPORT_REJECTIONS];

/** Paper size the crop needs at this scale, in the same units the crop is in. */
export function paperSizeForCrop(
  crop: CropRegion,
  scale: number,
): { readonly width: number; readonly height: number } {
  return {
    width: (crop.maxX - crop.minX) * scale,
    height: (crop.maxY - crop.minY) * scale,
  };
}

/**
 * Checks a crop against the page it has to fit on.
 *
 * Reported rather than auto-scaled. Silently changing the scale to make a crop
 * fit produces a drawing at 1:137, which nobody asked for and which reads as a
 * mistake on an issued sheet - drawing scales are conventional numbers for a
 * reason, and a person choosing between 1:100 and 1:200 is making a judgement a
 * fitting algorithm cannot make for them.
 */
export function checkCropFits(
  crop: CropRegion,
  scale: number,
  sheetWidth: number,
  sheetHeight: number,
): ViewportRejection | null {
  if (!Number.isFinite(scale) || scale <= 0) {
    return VIEWPORT_REJECTIONS.invalidScale;
  }
  if (crop.maxX <= crop.minX || crop.maxY <= crop.minY) {
    return VIEWPORT_REJECTIONS.emptyCrop;
  }
  const needed = paperSizeForCrop(crop, scale);
  return needed.width > sheetWidth || needed.height > sheetHeight
    ? VIEWPORT_REJECTIONS.cropTooLargeForSheet
    : null;
}

/**
 * The largest conventional scale at which a crop fits.
 *
 * Offered rather than applied, and drawn from the conventional set rather than
 * computed exactly, so the answer is a scale someone would write in a title
 * block.
 */
export const CONVENTIONAL_SCALES: readonly number[] = [
  1 / 1,
  1 / 2,
  1 / 5,
  1 / 10,
  1 / 20,
  1 / 50,
  1 / 100,
  1 / 200,
  1 / 500,
  1 / 1000,
  1 / 2000,
];

export function largestFittingScale(
  crop: CropRegion,
  sheetWidth: number,
  sheetHeight: number,
): number | null {
  for (const scale of CONVENTIONAL_SCALES) {
    if (checkCropFits(crop, scale, sheetWidth, sheetHeight) === null) {
      return scale;
    }
  }
  return null;
}

/** Model space to paper space, within a viewport. */
export function modelToPaper(
  point: { readonly x: number; readonly y: number },
  viewport: CroppedViewport,
): SheetPoint {
  const origin = viewport.crop ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    x: viewport.position.x + (point.x - origin.minX) * viewport.scale,
    y: viewport.position.y + (point.y - origin.minY) * viewport.scale,
  };
}

/**
 * Paper space back to model space.
 *
 * Needed because a click on a printed-layout preview has to reach the element
 * it landed on, and a pipeline that only converts one way makes selection on a
 * sheet impossible.
 */
export function paperToModel(
  point: SheetPoint,
  viewport: CroppedViewport,
): { readonly x: number; readonly y: number } {
  const origin = viewport.crop ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    x: origin.minX + (point.x - viewport.position.x) / viewport.scale,
    y: origin.minY + (point.y - viewport.position.y) / viewport.scale,
  };
}

/** Whether a model point is inside the crop, and so drawn. */
export function isWithinCrop(
  point: { readonly x: number; readonly y: number },
  viewport: CroppedViewport,
): boolean {
  const crop = viewport.crop;
  if (crop === undefined) {
    return true;
  }
  return (
    point.x >= crop.minX && point.x <= crop.maxX && point.y >= crop.minY && point.y <= crop.maxY
  );
}

/**
 * Annotation text height, in paper millimetres.
 *
 * The values a drawing office actually uses. Held as paper sizes because that
 * is what they are: 2.5mm text is 2.5mm on the sheet at every scale, which is
 * the whole point.
 */
export const ANNOTATION_TEXT_HEIGHTS_PAPER_MM = {
  small: 1.8,
  normal: 2.5,
  large: 3.5,
  title: 5,
} as const;

export type AnnotationTextSize = keyof typeof ANNOTATION_TEXT_HEIGHTS_PAPER_MM;

/**
 * How large annotation text has to be in *model* units to print at its paper
 * height at this scale.
 *
 * This is the conversion a renderer needs and the one that is easy to get
 * backwards. At 1:200 a 2.5mm label is 500 model-millimetres tall; at 1:20 it
 * is 50. A renderer that used one number for both makes the detail's labels
 * microscopic or the site plan's the size of a building - and it looks fine on
 * screen, because the screen zooms.
 */
export function annotationHeightInModelUnits(size: AnnotationTextSize, scale: number): number {
  return ANNOTATION_TEXT_HEIGHTS_PAPER_MM[size] / scale;
}

/**
 * Whether changing a viewport's scale changes what the drawing contains.
 *
 * Always false, and written as a function for the same reason
 * `visibleForSchedule` is: a crop is a model-space region, so rescaling changes
 * how much paper it needs and nothing else. A future change that made the crop
 * paper-relative would have to delete this and its test, which is the point.
 */
export function scaleChangesContent(): false {
  return false;
}

/**
 * Rescales a viewport, keeping the crop.
 *
 * Returns null when the new scale will not fit rather than cropping to
 * compensate. Quietly shrinking the crop would drop part of the drawing at the
 * moment the user was trying to make it fit, and they would find out at the
 * printer.
 */
export function withScale(
  viewport: CroppedViewport,
  scale: number,
  sheetWidth: number,
  sheetHeight: number,
): CroppedViewport | null {
  const crop = viewport.crop;
  if (crop !== undefined && checkCropFits(crop, scale, sheetWidth, sheetHeight) !== null) {
    return null;
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }
  return { ...viewport, scale };
}
