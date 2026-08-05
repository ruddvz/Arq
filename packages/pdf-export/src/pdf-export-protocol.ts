/**
 * V3-134: PDF generation happens off the main thread.
 *
 * Rendering a drawing set to PDF is the longest synchronous thing a CAD tool
 * does. Twenty sheets of vector linework with embedded fonts takes seconds at
 * best, and on the main thread those are seconds where the tab does not
 * repaint, does not respond to a click and does not run the cancel button the
 * user is now pressing repeatedly. Browsers eventually offer to close the page.
 *
 * Moving it to a worker is the easy half. The half that needs writing down is
 * the protocol, because three things go wrong in every version of this that was
 * built in a hurry:
 *
 * **Cancellation that does not cancel.** A cancel that only stops the main
 * thread listening leaves the worker rendering twenty sheets nobody wants, on a
 * device whose battery the user is watching. Cancellation is a request the
 * worker acknowledges, and the acknowledgement is a distinct response, so a
 * caller can tell "stopped" from "still going, quietly".
 *
 * **Progress that is a guess.** A fraction interpolated from a timer is worse
 * than no progress bar: it stalls at 90% and the user learns not to trust it.
 * Progress here is sheets completed out of sheets requested, which the worker
 * actually knows.
 *
 * **A result that is assumed good.** The worker returns bytes. Bytes are not a
 * PDF until something reads them as one - see `verifyExportedPdf`.
 *
 * Bytes cross as `ArrayBuffer` so they can be transferred rather than copied,
 * matching the import worker's existing protocol.
 */

import type { SheetExportMetadata } from './export-metadata';
import type { ArchitecturalScale } from './scale-validation';

export interface PdfSheetRequest {
  readonly sheetId: string;
  /** Paper size in millimetres, so the worker needs no sheet registry of its own. */
  readonly widthMm: number;
  readonly heightMm: number;
  /**
   * The drawing scale as written in a title block, e.g. 1:100. The worker never
   * picks a scale, and it is not a bare ratio: this repository has two
   * different "scale" ratios in circulation, and a worker boundary is the last
   * place to let them meet.
   */
  readonly scale: ArchitecturalScale;
}

export type PdfExportRequest =
  | {
      readonly type: 'export';
      readonly requestId: string;
      readonly sheets: readonly PdfSheetRequest[];
      readonly metadata: SheetExportMetadata;
      /** Serialised drawing content per sheet, produced on the main thread from the model. */
      readonly content: ArrayBuffer;
    }
  | { readonly type: 'cancel'; readonly requestId: string };

export interface PdfExportProgress {
  readonly sheetsCompleted: number;
  readonly sheetsRequested: number;
  /** The sheet being rendered, so a status line can name it rather than counting. */
  readonly currentSheetId: string | null;
}

export const PDF_EXPORT_FAILURE_CODES = {
  noSheets: 'ARQ_PDF_NO_SHEETS',
  invalidPaperSize: 'ARQ_PDF_INVALID_PAPER_SIZE',
  invalidScale: 'ARQ_PDF_INVALID_SCALE',
  fontUnavailable: 'ARQ_PDF_FONT_UNAVAILABLE',
  renderFailed: 'ARQ_PDF_RENDER_FAILED',
  unknownRequest: 'ARQ_PDF_UNKNOWN_REQUEST',
} as const;

export type PdfExportFailureCode =
  (typeof PDF_EXPORT_FAILURE_CODES)[keyof typeof PDF_EXPORT_FAILURE_CODES];

export type PdfExportResponse =
  | { readonly type: 'progress'; readonly requestId: string; readonly progress: PdfExportProgress }
  | {
      readonly type: 'exported';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
      readonly pageCount: number;
    }
  /** The worker confirming it stopped. Distinct from a caller deciding to stop listening. */
  | { readonly type: 'cancelled'; readonly requestId: string; readonly sheetsCompleted: number }
  | {
      readonly type: 'failed';
      readonly requestId: string;
      readonly code: PdfExportFailureCode;
      readonly message: string;
      /** Which sheet failed, when it was one sheet rather than the request. */
      readonly sheetId?: string;
    };

/**
 * Checks a request before it reaches the worker.
 *
 * On the main thread on purpose: a request that cannot succeed should fail
 * where the caller is, not after a worker spin-up and a message round trip that
 * makes a typo look like a rendering failure.
 */
export function validatePdfExportRequest(request: Extract<PdfExportRequest, { type: 'export' }>): {
  readonly code: PdfExportFailureCode;
  readonly message: string;
  readonly sheetId?: string;
} | null {
  if (request.sheets.length === 0) {
    return { code: PDF_EXPORT_FAILURE_CODES.noSheets, message: 'no sheets were requested' };
  }
  for (const sheet of request.sheets) {
    if (
      !Number.isFinite(sheet.widthMm) ||
      !Number.isFinite(sheet.heightMm) ||
      sheet.widthMm <= 0 ||
      sheet.heightMm <= 0
    ) {
      return {
        code: PDF_EXPORT_FAILURE_CODES.invalidPaperSize,
        message: `sheet ${sheet.sheetId} has no usable paper size`,
        sheetId: sheet.sheetId,
      };
    }
    if (
      !Number.isFinite(sheet.scale.modelUnitsPerPaperUnit) ||
      sheet.scale.modelUnitsPerPaperUnit <= 0
    ) {
      return {
        code: PDF_EXPORT_FAILURE_CODES.invalidScale,
        message: `sheet ${sheet.sheetId} has no usable scale`,
        sheetId: sheet.sheetId,
      };
    }
  }
  return null;
}

/**
 * Tracks one export from the caller's side.
 *
 * Holds the state a caller otherwise reinvents: whether a cancel was requested,
 * whether the worker acknowledged it, and whether a late `exported` should be
 * accepted. That last one is the case worth having a place for - a worker can
 * finish a sheet after the cancel arrives, and adopting that result hands the
 * user a PDF they cancelled.
 */
export function createPdfExportSession(requestId: string, sheetsRequested: number) {
  let cancelRequested = false;
  let settled = false;
  let lastProgress: PdfExportProgress = {
    sheetsCompleted: 0,
    sheetsRequested,
    currentSheetId: null,
  };

  function requestCancel(): PdfExportRequest {
    cancelRequested = true;
    return { type: 'cancel', requestId };
  }

  /** Whether the caller may act on a response, and why not when it may not. */
  function accept(response: PdfExportResponse):
    | { readonly acted: true; readonly response: PdfExportResponse }
    | {
        readonly acted: false;
        readonly reason: 'wrong-request' | 'after-cancel' | 'already-settled';
      } {
    if (response.requestId !== requestId) {
      return { acted: false, reason: 'wrong-request' };
    }
    if (settled) {
      return { acted: false, reason: 'already-settled' };
    }

    if (response.type === 'progress') {
      if (cancelRequested) {
        return { acted: false, reason: 'after-cancel' };
      }
      lastProgress = response.progress;
      return { acted: true, response };
    }

    if (response.type === 'exported' && cancelRequested) {
      // A worker that finished a sheet after the cancel arrived. Adopting this
      // hands the user a PDF they cancelled.
      return { acted: false, reason: 'after-cancel' };
    }

    settled = true;
    return { acted: true, response };
  }

  return {
    requestCancel,
    accept,
    progress: () => lastProgress,
    isCancelRequested: () => cancelRequested,
    isSettled: () => settled,
  };
}

export type PdfExportSession = ReturnType<typeof createPdfExportSession>;

/**
 * A fraction for a progress affordance, or null when there is nothing honest to
 * show.
 *
 * Null rather than 0 for a request with no sheets: a bar at zero says work is
 * happening, and a fraction interpolated from anything but completed sheets is
 * the stall-at-90% that teaches users to ignore progress bars.
 */
export function progressFraction(progress: PdfExportProgress): number | null {
  if (progress.sheetsRequested <= 0) {
    return null;
  }
  return progress.sheetsCompleted / progress.sheetsRequested;
}
