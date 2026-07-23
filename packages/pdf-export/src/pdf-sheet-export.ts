/**
 * ARQ-142: prototype pdf-lib vector export.
 *
 * Blueprint section 59 ("PDF export")'s Requirement: "Vector linework,
 * not a canvas screenshot", using `pdf-lib` (MIT, "can create and
 * modify PDF documents and draw vector content" - section 59's own
 * Candidate). This module is the "generate vector primitives" and
 * "write PDF" steps of section 59's ten-step Export pipeline - drawing
 * a sheet's already-projected paper-space geometry (`SheetViewportScene`,
 * ARQ-141) as real PDF vector operators, not a rasterised image.
 *
 * A genuine prototype, not the full pipeline: section 59's own
 * "Limitations to design around" - text wrapping, font embedding
 * testing, line joins/patterns validation, huge-drawing memory bounds -
 * are explicitly named as still-open validation work, not solved here.
 * Concretely:
 *
 * - Text is drawn with `StandardFonts.Helvetica` (a built-in PDF base14
 *   font needing no embedding) rather than an actual embedded Arq
 *   typeface - "font embedding must be tested" is deliberately deferred.
 * - Every line/polygon edge is drawn at a single flat 1pt thickness in
 *   black, ignoring each primitive's StyleToken - export sheets print
 *   the committed model, not live editor selection/hover state, and
 *   per-element line-weight selection (line-weight.ts, ARQ-120, already
 *   exists for the *editor* renderer) is its own, later integration,
 *   not this prototype's job.
 * - `SheetHandlePrimitive` is intentionally never drawn: a selection
 *   handle (section 18) is an interactive editor affordance with no
 *   printed meaning on an exported sheet.
 * - Steps 1-3 and 6-10 of section 59's pipeline (freeze snapshot,
 *   validate sheet, resolve fonts, validate page count/bounds, store
 *   export record, return download, never modify project state) are
 *   orchestration this prototype does not attempt - this module is a
 *   pure function from already-built inputs to PDF bytes, touching no
 *   project state at all, which is exactly what upholds "never modify
 *   project state" by construction. Step 5, "add metadata", is
 *   export-metadata.ts's job (ARQ-145), applied here rather than
 *   duplicated inline.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Sheet } from '@arq/bim-core';
import type { SheetPrimitive, SheetSpacePoint, SheetViewportScene } from '@arq/plan-renderer';
import { applySheetExportMetadata } from './export-metadata';

const LINE_THICKNESS_PT = 1;
const TEXT_SIZE_PT = 10;
const BLACK = rgb(0, 0, 0);

export interface ExportSheetToPdfInput<TId> {
  readonly sheet: Sheet;
  readonly projectName: string;
  readonly viewportScene: SheetViewportScene<TId>;
  /** PDF page size in points (1/72 inch) - the paper-space units SheetViewportScene's points are already expressed in. */
  readonly pageWidthPt: number;
  readonly pageHeightPt: number;
}

/** Renders one sheet's already-projected viewport scene to real PDF vector content. Never reads or writes any project state - a pure function from inputs to bytes. */
export async function exportSheetToPdf<TId>(
  input: ExportSheetToPdfInput<TId>,
): Promise<Uint8Array> {
  if (!Number.isFinite(input.pageWidthPt) || input.pageWidthPt <= 0) {
    throw new RangeError('pageWidthPt must be a positive finite number');
  }
  if (!Number.isFinite(input.pageHeightPt) || input.pageHeightPt <= 0) {
    throw new RangeError('pageHeightPt must be a positive finite number');
  }

  const document = await PDFDocument.create();
  const page = document.addPage([input.pageWidthPt, input.pageHeightPt]);
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (const primitive of input.viewportScene.primitives) {
    drawSheetPrimitive(page, primitive, font);
  }

  applySheetExportMetadata(document, {
    projectName: input.projectName,
    sheetNumber: input.sheet.number,
    sheetTitle: input.sheet.title,
    revision: input.sheet.revision,
  });

  return document.save();
}

function drawSheetPrimitive<TId>(
  page: PDFPage,
  primitive: SheetPrimitive<TId>,
  font: PDFFont,
): void {
  switch (primitive.kind) {
    case 'line':
      drawPolyline(page, primitive.points, false);
      return;
    case 'polygon':
      drawPolyline(page, primitive.points, true);
      return;
    case 'text':
      page.drawText(primitive.text, {
        x: primitive.anchor.x,
        y: primitive.anchor.y,
        size: TEXT_SIZE_PT,
        font,
        color: BLACK,
      });
      return;
    case 'handle':
      return;
  }
}

/** Draws each edge of a polyline as a straight PDF vector line; `closed` also draws the edge back from the last point to the first. */
function drawPolyline(page: PDFPage, points: readonly SheetSpacePoint[], closed: boolean): void {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (start === undefined || end === undefined) {
      continue;
    }
    page.drawLine({ start, end, thickness: LINE_THICKNESS_PT, color: BLACK });
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (closed && points.length > 2 && first !== undefined && last !== undefined) {
    page.drawLine({ start: last, end: first, thickness: LINE_THICKNESS_PT, color: BLACK });
  }
}
