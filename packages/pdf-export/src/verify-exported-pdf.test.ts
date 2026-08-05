import { describe, expect, it } from 'vitest';
import {
  PDF_VERIFICATION_REFUSALS,
  pagesWithUncheckedScale,
  verifyExportedPdf,
  type ExpectedPdfPage,
  type IndependentPdfReader,
  type ObservedPdf,
} from './verify-exported-pdf';

const TOLERANCES = { pageSizeToleranceMm: 0.5, scaleToleranceMm: 0.2 };
const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function expectedPage(overrides: Partial<ExpectedPdfPage> = {}): ExpectedPdfPage {
  return {
    sheetId: 'sheet-1',
    widthMm: 841,
    heightMm: 594,
    scale: { modelUnitsPerPaperUnit: 100 },
    calibration: { modelLengthMm: 10_000 },
    ...overrides,
  };
}

function readerReturning(observed: ObservedPdf | null): IndependentPdfReader {
  return { read: () => observed };
}

function observed(overrides: Partial<ObservedPdf> = {}): ObservedPdf {
  return {
    pageCount: 1,
    // 10,000mm of model at 1:100 prints at 100mm.
    pages: [{ widthMm: 841, heightMm: 594, calibrationLengthMm: 100 }],
    embeddedFontNames: ['ArqSans'],
    referencedNotEmbedded: [],
    byteLength: 4096,
    ...overrides,
  };
}

describe('verifyExportedPdf', () => {
  it('verifies a PDF the reader agrees with', () => {
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(observed()),
      TOLERANCES,
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;
    expect(result.receipt.pageCount).toBe(1);
    expect(result.receipt.scaleCheckedPageIds).toEqual(['sheet-1']);
  });

  it('refuses bytes an independent reader cannot open', () => {
    // Whatever the writer believes, this is not a PDF anybody can send.
    const result = verifyExportedPdf(BYTES, [expectedPage()], readerReturning(null), TOLERANCES);

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.unreadable);
  });

  it('refuses an empty output before it asks a reader', () => {
    const result = verifyExportedPdf(
      new Uint8Array(0),
      [expectedPage()],
      readerReturning(observed()),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.emptyOutput);
  });

  it('refuses a missing page, which is a page nobody looks for', () => {
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage(), expectedPage({ sheetId: 'sheet-2' })],
      readerReturning(observed()),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.pageCountMismatch);
    expect(result.detail).toContain('expected 2 pages');
  });

  it('refuses a font referenced but not embedded', () => {
    // Renders correctly on the machine that has the font and substitutes
    // silently on the machine that does not.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(observed({ referencedNotEmbedded: ['HelveticaNeue'] })),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.fontNotEmbedded);
    expect(result.detail).toContain('HelveticaNeue');
  });

  it('trusts the reader about embedding, not the writer', () => {
    // The observed list is what counts; a writer's record of what it meant to
    // embed is a statement about the writer.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(observed({ embeddedFontNames: [], referencedNotEmbedded: ['ArqSans'] })),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
  });

  it('refuses a page written at the wrong size', () => {
    // A page at the wrong size prints scaled, so every measured length on it is
    // wrong by a ratio nobody notices.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(observed({ pages: [{ widthMm: 594, heightMm: 420 }] })),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.pageSizeMismatch);
    expect(result.sheetId).toBe('sheet-1');
  });

  it('accepts a page size within the declared tolerance', () => {
    // PDF stores sizes in points, so a millimetre size never round-trips
    // exactly.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(
        observed({ pages: [{ widthMm: 841.3, heightMm: 593.8, calibrationLengthMm: 100 }] }),
      ),
      TOLERANCES,
    );

    expect(result.status).toBe('verified');
  });

  it('refuses a drawing printed at the wrong scale, measured rather than declared', () => {
    // A PDF can carry a title-block string saying 1:100 and be drawn at 1:137.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(
        observed({ pages: [{ widthMm: 841, heightMm: 594, calibrationLengthMm: 73 }] }),
      ),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.scaleMismatch);
    expect(result.detail).toContain('should print at 100.00mm');
  });

  it('accepts a measured length within the scale tolerance', () => {
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(
        observed({ pages: [{ widthMm: 841, heightMm: 594, calibrationLengthMm: 100.1 }] }),
      ),
      TOLERANCES,
    );

    expect(result.status).toBe('verified');
  });

  it('refuses on the first mismatch rather than listing derived ones', () => {
    // The first mismatch usually causes the rest, and a list of twenty derived
    // failures buries the one that matters.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(
        observed({
          referencedNotEmbedded: ['ArqSans'],
          pages: [{ widthMm: 100, heightMm: 100, calibrationLengthMm: 3 }],
        }),
      ),
      TOLERANCES,
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PDF_VERIFICATION_REFUSALS.fontNotEmbedded);
  });

  it('verifies a page whose scale could not be measured, and says so', () => {
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage()],
      readerReturning(observed({ pages: [{ widthMm: 841, heightMm: 594 }] })),
      TOLERANCES,
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;
    expect(result.receipt.scaleCheckedPageIds).toEqual([]);
  });

  it('verifies several pages together', () => {
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage(), expectedPage({ sheetId: 'sheet-2' })],
      readerReturning(
        observed({
          pageCount: 2,
          pages: [
            { widthMm: 841, heightMm: 594, calibrationLengthMm: 100 },
            { widthMm: 841, heightMm: 594, calibrationLengthMm: 100 },
          ],
        }),
      ),
      TOLERANCES,
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;
    expect(result.receipt.scaleCheckedPageIds).toEqual(['sheet-1', 'sheet-2']);
  });
});

describe('pagesWithUncheckedScale', () => {
  it('names pages whose scale was taken on trust', () => {
    // A receipt saying "verified" over pages nobody measured is the half-truth
    // this module exists to remove.
    const result = verifyExportedPdf(
      BYTES,
      [expectedPage(), expectedPage({ sheetId: 'sheet-2' })],
      readerReturning(
        observed({
          pageCount: 2,
          pages: [
            { widthMm: 841, heightMm: 594, calibrationLengthMm: 100 },
            { widthMm: 841, heightMm: 594 },
          ],
        }),
      ),
      TOLERANCES,
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;
    expect(
      pagesWithUncheckedScale(
        [expectedPage(), expectedPage({ sheetId: 'sheet-2' })],
        result.receipt,
      ),
    ).toEqual(['sheet-2']);
  });
});
