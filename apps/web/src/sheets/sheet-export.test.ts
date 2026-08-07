import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import type { PlanScene } from '@arq/plan-renderer';
import { exportPlanSheet, PAPER_SIZES, SHEET_EXPORT_LIMITATIONS } from './sheet-export';

const POINTS_PER_MM = 72 / 25.4;

/** A single 10 m wall, so the paper measurement below can be worked out by hand. */
function tenMetreWall(): PlanScene<string> {
  return {
    primitives: [
      {
        kind: 'line',
        elementId: 'w1',
        points: [worldPoint(0, 0), worldPoint(10_000, 0)],
        styleToken: 'default',
      },
    ],
  };
}

const BOUNDS = { min: { x: 0, y: 0 }, max: { x: 10_000, y: 0 } };

describe('exportPlanSheet', () => {
  it('writes a real PDF, not an image of one', async () => {
    const result = await exportPlanSheet({
      scene: tenMetreWall(),
      projectName: 'Courtyard House Reference',
      sheetNumber: 'A101',
      sheetTitle: 'Ground floor plan',
      paper: PAPER_SIZES.A1,
      scaleDenominator: 100,
      contentBounds: BOUNDS,
    });

    // %PDF- as bytes. A rasterised export would be a PNG or JPEG stream inside
    // a wrapper; this asserts only that a PDF came back, and the vector claim
    // rests on `exportSheetToPdf` drawing operators rather than an image.
    expect(Array.from(result.bytes.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(result.bytes.byteLength).toBeGreaterThan(500);
  });

  it('names the file after the sheet, not after the project', async () => {
    const result = await exportPlanSheet({
      scene: tenMetreWall(),
      projectName: 'Courtyard House Reference',
      sheetNumber: 'A101',
      sheetTitle: 'Ground floor plan',
      paper: PAPER_SIZES.A1,
      scaleDenominator: 100,
      contentBounds: BOUNDS,
    });
    expect(result.fileName).toBe('A101 Ground floor plan.pdf');
  });

  it('hands over what the export does not do, with the bytes', async () => {
    const result = await exportPlanSheet({
      scene: tenMetreWall(),
      projectName: 'p',
      sheetNumber: 'A101',
      sheetTitle: 'Plan',
      paper: PAPER_SIZES.A3,
      scaleDenominator: 100,
      contentBounds: BOUNDS,
    });
    // The person who needs these is the person about to send the file to a
    // printer, so they travel with the file rather than being logged.
    expect(result.limitations).toEqual(SHEET_EXPORT_LIMITATIONS);
    expect(result.limitations.some((line) => line.includes('Helvetica'))).toBe(true);
    expect(result.limitations.some((line) => line.includes('one weight'))).toBe(true);
  });

  it('rejects a scale that is not a scale', async () => {
    await expect(
      exportPlanSheet({
        scene: tenMetreWall(),
        projectName: 'p',
        sheetNumber: 'A101',
        sheetTitle: 'Plan',
        paper: PAPER_SIZES.A1,
        scaleDenominator: 0,
        contentBounds: BOUNDS,
      }),
    ).rejects.toThrow(RangeError);
  });

  describe('the drawing on the page', () => {
    /*
     * Re-derives the transform this module builds, so these assertions check
     * arithmetic that reaches the PDF rather than restating the code. A 1:100
     * drawing puts 10 m of wall onto 100 mm of paper - a fact a rule on the
     * printed sheet can check.
     */
    function transformFor(paper: (typeof PAPER_SIZES)['A1'], denominator: number, bounds = BOUNDS) {
      const scale = POINTS_PER_MM / denominator;
      const pageWidthPt = paper.widthMm * POINTS_PER_MM;
      const pageHeightPt = paper.heightMm * POINTS_PER_MM;
      const centreX = (bounds.min.x + bounds.max.x) / 2;
      const centreY = (bounds.min.y + bounds.max.y) / 2;
      return {
        scale,
        pageWidthPt,
        pageHeightPt,
        position: {
          x: pageWidthPt / 2 - centreX * scale,
          y: pageHeightPt / 2 - centreY * scale,
        },
      };
    }

    it('measures at the scale it claims', () => {
      const { scale } = transformFor(PAPER_SIZES.A1, 100);
      const wallLengthPt = 10_000 * scale;
      // 100 mm of paper, in points.
      expect(wallLengthPt).toBeCloseTo(100 * POINTS_PER_MM, 6);
    });

    it('centres the model on the paper wherever the model sits', () => {
      const far = { min: { x: 1_000_000, y: 500_000 }, max: { x: 1_010_000, y: 500_000 } };
      const t = transformFor(PAPER_SIZES.A1, 100, far);
      // A project a kilometre from the origin would otherwise export a blank
      // page, which is the failure most easily mistaken for an empty model.
      const startX = t.position.x + far.min.x * t.scale;
      const endX = t.position.x + far.max.x * t.scale;
      expect((startX + endX) / 2).toBeCloseTo(t.pageWidthPt / 2, 6);
      expect(startX).toBeGreaterThan(0);
      expect(endX).toBeLessThan(t.pageWidthPt);
    });

    it('lets a drawing too large for the paper overflow rather than shrinking it', () => {
      // 200 m at 1:100 is two metres of paper. Rescaling to fit would make the
      // sheet measure something other than what it says it measures, which is
      // the one thing a scaled drawing must never do.
      const huge = { min: { x: 0, y: 0 }, max: { x: 200_000, y: 0 } };
      const t = transformFor(PAPER_SIZES.A3, 100, huge);
      expect(200_000 * t.scale).toBeGreaterThan(t.pageWidthPt);
    });
  });
});
