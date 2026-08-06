import type { Sheet } from '@arq/bim-core';
import { buildPlanViewport, type PlanScene } from '@arq/plan-renderer';
import { exportSheetToPdf } from '@arq/pdf-export';

/**
 * Turning what is on the plan into a vector PDF sheet.
 *
 * Every piece of this existed and none of it was reachable. `buildPlanViewport`
 * projects a plan scene into paper space, `exportSheetToPdf` writes real PDF
 * vector operators - blueprint section 59's "vector linework, not a canvas
 * screenshot" - and `applySheetExportMetadata` stamps the document. No
 * application code called any of them, so the product could draw a plan and had
 * no way to produce a sheet from it.
 *
 * This module is the orchestration between them, and the place the export's
 * real limits are written down. That second job is the important one: a PDF
 * that silently drops line weights and substitutes a font looks finished, and a
 * user who prints it discovers the difference at the worst possible moment.
 */

/** Points per millimetre. A PDF point is 1/72 inch; model units here are millimetres. */
const POINTS_PER_MM = 72 / 25.4;

export interface PaperSize {
  readonly name: string;
  readonly widthMm: number;
  readonly heightMm: number;
}

/** The ISO sizes an architectural sheet is actually issued at, landscape. */
export const PAPER_SIZES: Readonly<Record<'A1' | 'A2' | 'A3', PaperSize>> = {
  A1: { name: 'A1', widthMm: 841, heightMm: 594 },
  A2: { name: 'A2', widthMm: 594, heightMm: 420 },
  A3: { name: 'A3', widthMm: 420, heightMm: 297 },
};

export interface SheetExportRequest<TId> {
  readonly scene: PlanScene<TId>;
  readonly projectName: string;
  readonly sheetNumber: string;
  readonly sheetTitle: string;
  readonly paper: PaperSize;
  /** Drawing scale as its denominator: 100 means 1:100. */
  readonly scaleDenominator: number;
  /**
   * The model-space box the sheet frames, so the drawing is centred on the
   * paper rather than placed at whatever coordinates the model happens to use.
   * A project whose origin is a kilometre away would otherwise export a blank
   * page, which is the failure most likely to be mistaken for an empty model.
   */
  readonly contentBounds: {
    readonly min: { readonly x: number; readonly y: number };
    readonly max: { readonly x: number; readonly y: number };
  };
}

export interface SheetExportResult {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  /**
   * What this export does not do, in the user's terms. Carried with the bytes
   * rather than logged, because the person who needs it is the person about to
   * send the file to a printer.
   */
  readonly limitations: readonly string[];
}

/**
 * The prototype's own documented gaps, restated as things a user can act on.
 *
 * These are not guesses about the exporter: `pdf-sheet-export.ts` states each
 * one in its own header as deliberately deferred work. What was missing is
 * anyone telling the person holding the file.
 */
export const SHEET_EXPORT_LIMITATIONS: readonly string[] = [
  'Text is drawn in Helvetica, not the Arq typeface. Type will not match what you see on screen.',
  'Every line is drawn at one weight. The drawing does not yet distinguish cut linework from projected linework the way a printed sheet should.',
  'The sheet has no title block, north point or scale bar. The drawing is on the page and nothing frames it.',
  'Only the level currently on the plan is exported, as one sheet.',
];

/**
 * Fits the model into the page and exports it.
 *
 * The scale is honoured, not fitted-to-page: a drawing issued at 1:100 has to
 * measure 1:100 when someone puts a rule on it, so a model too large for the
 * paper overflows the page rather than being quietly shrunk to fit. Silently
 * rescaling is the one behaviour that turns a sheet into a lie about its own
 * dimensions.
 */
export async function exportPlanSheet<TId>(
  request: SheetExportRequest<TId>,
): Promise<SheetExportResult> {
  if (!Number.isFinite(request.scaleDenominator) || request.scaleDenominator <= 0) {
    throw new RangeError('scaleDenominator must be a positive finite number');
  }

  const pageWidthPt = request.paper.widthMm * POINTS_PER_MM;
  const pageHeightPt = request.paper.heightMm * POINTS_PER_MM;
  // Paper points per model millimetre.
  const scale = POINTS_PER_MM / request.scaleDenominator;

  const centreX = (request.contentBounds.min.x + request.contentBounds.max.x) / 2;
  const centreY = (request.contentBounds.min.y + request.contentBounds.max.y) / 2;

  const sheet: Sheet = {
    id: `sheet-${request.sheetNumber}` as Sheet['id'],
    projectId: 'exported' as Sheet['projectId'],
    number: request.sheetNumber,
    title: request.sheetTitle,
    size: { kind: 'standard', name: request.paper.name },
    viewport: {
      viewId: 'plan' as Sheet['viewport']['viewId'],
      scale,
      /*
       * Places the model's centre at the page's centre. `projectPointToSheet`
       * adds this position after scaling, so the offset is the page centre less
       * the scaled model centre - not the model centre itself, which would put
       * the drawing off the page by however far the model sits from the origin.
       */
      position: {
        x: pageWidthPt / 2 - centreX * scale,
        y: pageHeightPt / 2 - centreY * scale,
      },
    },
    revision: 0,
  };

  const viewportScene = buildPlanViewport(request.scene, sheet.viewport);
  const bytes = await exportSheetToPdf({
    sheet,
    projectName: request.projectName,
    viewportScene,
    pageWidthPt,
    pageHeightPt,
  });

  return {
    bytes,
    fileName: `${request.sheetNumber} ${request.sheetTitle}.pdf`,
    limitations: SHEET_EXPORT_LIMITATIONS,
  };
}
