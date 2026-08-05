import { describe, expect, it } from 'vitest';
import type { SheetExportMetadata } from './export-metadata';
import {
  PDF_EXPORT_FAILURE_CODES,
  createPdfExportSession,
  progressFraction,
  validatePdfExportRequest,
  type PdfExportRequest,
  type PdfSheetRequest,
} from './pdf-export-protocol';

const METADATA = { title: 'Ground floor plan' } as unknown as SheetExportMetadata;

function sheet(overrides: Partial<PdfSheetRequest> = {}): PdfSheetRequest {
  return {
    sheetId: 'sheet-1',
    widthMm: 841,
    heightMm: 594,
    scale: { modelUnitsPerPaperUnit: 100 },
    ...overrides,
  };
}

function request(
  sheets: readonly PdfSheetRequest[],
): Extract<PdfExportRequest, { type: 'export' }> {
  return {
    type: 'export',
    requestId: 'req-1',
    sheets,
    metadata: METADATA,
    content: new ArrayBuffer(8),
  };
}

describe('validatePdfExportRequest', () => {
  it('accepts a usable request', () => {
    expect(validatePdfExportRequest(request([sheet()]))).toBeNull();
  });

  it('rejects a request with no sheets', () => {
    expect(validatePdfExportRequest(request([]))?.code).toBe(PDF_EXPORT_FAILURE_CODES.noSheets);
  });

  it('rejects an unusable paper size and names the sheet', () => {
    // Failing on the main thread, so a typo does not look like a rendering
    // failure after a worker round trip.
    const failure = validatePdfExportRequest(request([sheet({ widthMm: 0 })]));

    expect(failure?.code).toBe(PDF_EXPORT_FAILURE_CODES.invalidPaperSize);
    expect(failure?.sheetId).toBe('sheet-1');
  });

  it('rejects an unusable scale', () => {
    expect(
      validatePdfExportRequest(request([sheet({ scale: { modelUnitsPerPaperUnit: 0 } })]))?.code,
    ).toBe(PDF_EXPORT_FAILURE_CODES.invalidScale);
    expect(
      validatePdfExportRequest(request([sheet({ scale: { modelUnitsPerPaperUnit: Number.NaN } })]))
        ?.code,
    ).toBe(PDF_EXPORT_FAILURE_CODES.invalidScale);
  });

  it('checks every sheet, not just the first', () => {
    const failure = validatePdfExportRequest(
      request([sheet(), sheet({ sheetId: 'sheet-2', heightMm: -1 })]),
    );

    expect(failure?.sheetId).toBe('sheet-2');
  });
});

describe('createPdfExportSession', () => {
  it('accepts progress for its own request', () => {
    const session = createPdfExportSession('req-1', 20);

    const outcome = session.accept({
      type: 'progress',
      requestId: 'req-1',
      progress: { sheetsCompleted: 3, sheetsRequested: 20, currentSheetId: 'sheet-4' },
    });

    expect(outcome.acted).toBe(true);
    expect(session.progress().sheetsCompleted).toBe(3);
  });

  it('ignores a response for a different request', () => {
    const session = createPdfExportSession('req-1', 20);

    const outcome = session.accept({ type: 'cancelled', requestId: 'req-2', sheetsCompleted: 0 });

    expect(outcome).toEqual({ acted: false, reason: 'wrong-request' });
  });

  it('makes cancellation a request the worker has to answer', () => {
    // A cancel that only stops the main thread listening leaves the worker
    // rendering twenty sheets nobody wants.
    const session = createPdfExportSession('req-1', 20);

    expect(session.requestCancel()).toEqual({ type: 'cancel', requestId: 'req-1' });
    expect(session.isCancelRequested()).toBe(true);
    expect(session.isSettled()).toBe(false);
  });

  it('settles on the worker acknowledging the cancel', () => {
    const session = createPdfExportSession('req-1', 20);
    session.requestCancel();

    const outcome = session.accept({
      type: 'cancelled',
      requestId: 'req-1',
      sheetsCompleted: 4,
    });

    expect(outcome.acted).toBe(true);
    expect(session.isSettled()).toBe(true);
  });

  it('refuses a result that arrives after a cancel', () => {
    // A worker can finish a sheet after the cancel arrives, and adopting that
    // hands the user a PDF they cancelled.
    const session = createPdfExportSession('req-1', 20);
    session.requestCancel();

    const outcome = session.accept({
      type: 'exported',
      requestId: 'req-1',
      bytes: new ArrayBuffer(64),
      pageCount: 20,
    });

    expect(outcome).toEqual({ acted: false, reason: 'after-cancel' });
  });

  it('stops reporting progress after a cancel', () => {
    const session = createPdfExportSession('req-1', 20);
    session.accept({
      type: 'progress',
      requestId: 'req-1',
      progress: { sheetsCompleted: 3, sheetsRequested: 20, currentSheetId: 's' },
    });
    session.requestCancel();

    session.accept({
      type: 'progress',
      requestId: 'req-1',
      progress: { sheetsCompleted: 9, sheetsRequested: 20, currentSheetId: 's' },
    });

    expect(session.progress().sheetsCompleted).toBe(3);
  });

  it('still accepts a failure after a cancel, so a caller learns why it stopped', () => {
    const session = createPdfExportSession('req-1', 20);
    session.requestCancel();

    const outcome = session.accept({
      type: 'failed',
      requestId: 'req-1',
      code: PDF_EXPORT_FAILURE_CODES.renderFailed,
      message: 'out of memory',
    });

    expect(outcome.acted).toBe(true);
  });

  it('acts on a settlement exactly once', () => {
    const session = createPdfExportSession('req-1', 1);
    session.accept({
      type: 'exported',
      requestId: 'req-1',
      bytes: new ArrayBuffer(4),
      pageCount: 1,
    });

    const second = session.accept({
      type: 'exported',
      requestId: 'req-1',
      bytes: new ArrayBuffer(4),
      pageCount: 1,
    });

    expect(second).toEqual({ acted: false, reason: 'already-settled' });
  });
});

describe('progressFraction', () => {
  it('counts completed sheets rather than interpolating', () => {
    // A fraction from a timer stalls at 90% and teaches users to ignore
    // progress bars.
    expect(
      progressFraction({ sheetsCompleted: 5, sheetsRequested: 20, currentSheetId: null }),
    ).toBe(0.25);
  });

  it('is null when there is nothing honest to show', () => {
    expect(
      progressFraction({ sheetsCompleted: 0, sheetsRequested: 0, currentSheetId: null }),
    ).toBeNull();
  });
});
