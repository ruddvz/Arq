import {
  architecturalScaleToViewportScale,
  printedLengthMm,
  type ArchitecturalScale,
} from './scale-validation';

/**
 * V3-135: a PDF is not exported until an independent reader has read it back.
 *
 * The same reasoning as `publishProjectFile`, applied to the other file a user
 * sends to somebody else. A PDF export that "succeeded" means the writer
 * finished without throwing, which is a statement about the writer. What the
 * user needs to know is whether the file a consultant opens tomorrow contains
 * the drawing - and the writer is the last component qualified to answer that,
 * because it would be checking its own belief about what it wrote.
 *
 * A PDF fails in ways that do not throw. A font that failed to embed produces a
 * file that renders correctly on the machine that has the font and substitutes
 * silently on the machine that does not - which is how a dimension string
 * becomes unreadable on the only computer that mattered. A page written at the
 * wrong size prints scaled, so every measured length on it is wrong by a ratio
 * nobody notices until something is built. A missing page is a page nobody
 * looks for.
 *
 * So the reader is injected, it must not be the writer, and its own findings -
 * not the writer's record - are what the checks compare. `expected` comes from
 * the request; `observed` comes from the reader; a mismatch refuses.
 *
 * Scale is checked by measuring, not by reading a metadata field. A PDF can
 * carry a `/UserUnit` or a title-block string saying 1:100 and be drawn at
 * 1:137; the number that matters is how long a known model length actually is
 * on the page.
 *
 * The expected scale is an `ArchitecturalScale` - the "1:N" a person names -
 * rather than a bare ratio. Two different ratios are in play in this codebase:
 * `sheet-viewport.ts` uses paper units per model unit (0.01 for 1:100) and
 * `scale-validation.ts` uses PDF points per world millimetre (0.0283 for the
 * same drawing). A field called `viewportScale` accepting either is a
 * factor-of-28 error waiting in a check whose whole job is catching wrong
 * scales, so this takes the one form nobody writes two ways.
 */

export interface ExpectedPdfPage {
  readonly sheetId: string;
  readonly widthMm: number;
  readonly heightMm: number;
  /** The drawing scale as it is written in a title block, e.g. 1:100. */
  readonly scale: ArchitecturalScale;
  /**
   * A model length the exporter drew on this page, and the page-space length it
   * should have. Lets the check measure rather than trust a declaration.
   */
  readonly calibration?: {
    readonly modelLengthMm: number;
  };
}

export interface ObservedPdfPage {
  readonly widthMm: number;
  readonly heightMm: number;
  /** Measured length in page millimetres of the calibration mark, when the reader found one. */
  readonly calibrationLengthMm?: number;
}

export interface ObservedPdf {
  readonly pageCount: number;
  readonly pages: readonly ObservedPdfPage[];
  /** Font names the reader found embedded. Not the ones the writer meant to embed. */
  readonly embeddedFontNames: readonly string[];
  /** Fonts referenced by content but not embedded. The reader's own finding. */
  readonly referencedNotEmbedded: readonly string[];
  readonly byteLength: number;
}

/** Reads a PDF back. Must share no state with the writer - that is what makes it evidence. */
export interface IndependentPdfReader {
  read(bytes: Uint8Array): ObservedPdf | null;
}

export const PDF_VERIFICATION_REFUSALS = {
  unreadable: 'ARQ_PDF_UNREADABLE',
  pageCountMismatch: 'ARQ_PDF_PAGE_COUNT_MISMATCH',
  pageSizeMismatch: 'ARQ_PDF_PAGE_SIZE_MISMATCH',
  fontNotEmbedded: 'ARQ_PDF_FONT_NOT_EMBEDDED',
  scaleMismatch: 'ARQ_PDF_SCALE_MISMATCH',
  emptyOutput: 'ARQ_PDF_EMPTY_OUTPUT',
} as const;

export type PdfVerificationRefusal =
  (typeof PDF_VERIFICATION_REFUSALS)[keyof typeof PDF_VERIFICATION_REFUSALS];

export interface PdfVerificationReceipt {
  readonly pageCount: number;
  readonly byteLength: number;
  readonly embeddedFontCount: number;
  /** Every page whose calibration was measured, so the receipt says what was checked. */
  readonly scaleCheckedPageIds: readonly string[];
}

export type PdfVerification =
  | { readonly status: 'verified'; readonly receipt: PdfVerificationReceipt }
  | {
      readonly status: 'refused';
      readonly code: PdfVerificationRefusal;
      readonly detail: string;
      readonly sheetId?: string;
    };

export interface VerifyExportedPdfOptions {
  /**
   * Page size tolerance in millimetres. Required rather than defaulted: PDF
   * stores sizes in points, so a millimetre size never round-trips exactly, and
   * the size of the acceptable error is a decision rather than an epsilon.
   */
  readonly pageSizeToleranceMm: number;
  /** Tolerance on the measured calibration length, in page millimetres. */
  readonly scaleToleranceMm: number;
}

/**
 * Verifies exported bytes against what was asked for.
 *
 * Refuses on the first mismatch and names the sheet. A report listing every
 * problem sounds better and is worse here: the first mismatch usually causes
 * the rest, and a list of twenty derived failures buries the one that matters.
 */
export function verifyExportedPdf(
  bytes: Uint8Array,
  expected: readonly ExpectedPdfPage[],
  reader: IndependentPdfReader,
  options: VerifyExportedPdfOptions,
): PdfVerification {
  if (bytes.byteLength === 0) {
    return {
      status: 'refused',
      code: PDF_VERIFICATION_REFUSALS.emptyOutput,
      detail: 'the exporter produced no bytes',
    };
  }

  const observed = reader.read(bytes);
  if (observed === null) {
    // The reader could not open it at all. Whatever the writer believes, this
    // is not a PDF anybody can send.
    return {
      status: 'refused',
      code: PDF_VERIFICATION_REFUSALS.unreadable,
      detail: 'an independent reader could not open the exported bytes',
    };
  }

  if (observed.pageCount !== expected.length) {
    return {
      status: 'refused',
      code: PDF_VERIFICATION_REFUSALS.pageCountMismatch,
      detail: `expected ${expected.length} pages, the reader found ${observed.pageCount}`,
    };
  }

  if (observed.referencedNotEmbedded.length > 0) {
    // Renders correctly on the machine that has the font and substitutes
    // silently on the machine that does not.
    return {
      status: 'refused',
      code: PDF_VERIFICATION_REFUSALS.fontNotEmbedded,
      detail: `${observed.referencedNotEmbedded.join(', ')} is referenced but not embedded`,
    };
  }

  const scaleCheckedPageIds: string[] = [];

  for (let index = 0; index < expected.length; index += 1) {
    const want = expected[index];
    const got = observed.pages[index];
    if (want === undefined || got === undefined) {
      return {
        status: 'refused',
        code: PDF_VERIFICATION_REFUSALS.pageCountMismatch,
        detail: `the reader returned no page at index ${index}`,
      };
    }

    if (
      Math.abs(got.widthMm - want.widthMm) > options.pageSizeToleranceMm ||
      Math.abs(got.heightMm - want.heightMm) > options.pageSizeToleranceMm
    ) {
      // A page at the wrong size prints scaled, so every measured length on it
      // is wrong by a ratio nobody notices.
      return {
        status: 'refused',
        code: PDF_VERIFICATION_REFUSALS.pageSizeMismatch,
        detail: `expected ${want.widthMm}×${want.heightMm}mm, the reader measured ${got.widthMm}×${got.heightMm}mm`,
        sheetId: want.sheetId,
      };
    }

    const calibration = want.calibration;
    if (calibration !== undefined && got.calibrationLengthMm !== undefined) {
      // Measured, not read from a metadata field: a PDF can declare 1:100 and
      // be drawn at 1:137.
      const shouldBe = printedLengthMm(
        calibration.modelLengthMm,
        architecturalScaleToViewportScale(want.scale),
      );
      if (Math.abs(got.calibrationLengthMm - shouldBe) > options.scaleToleranceMm) {
        return {
          status: 'refused',
          code: PDF_VERIFICATION_REFUSALS.scaleMismatch,
          detail: `a ${calibration.modelLengthMm}mm model length should print at ${shouldBe.toFixed(2)}mm, the reader measured ${got.calibrationLengthMm.toFixed(2)}mm`,
          sheetId: want.sheetId,
        };
      }
      scaleCheckedPageIds.push(want.sheetId);
    }
  }

  return {
    status: 'verified',
    receipt: {
      pageCount: observed.pageCount,
      byteLength: observed.byteLength,
      embeddedFontCount: observed.embeddedFontNames.length,
      scaleCheckedPageIds,
    },
  };
}

/**
 * Which pages carried no calibration mark, and so had their scale taken on
 * trust.
 *
 * Reported rather than hidden. A receipt saying "verified" over pages whose
 * scale nobody measured is the kind of half-truth this module exists to remove,
 * and the honest fix is for the exporter to draw a calibration mark on every
 * page - which this makes visible as an absence.
 */
export function pagesWithUncheckedScale(
  expected: readonly ExpectedPdfPage[],
  receipt: PdfVerificationReceipt,
): readonly string[] {
  const checked = new Set(receipt.scaleCheckedPageIds);
  return expected.filter((page) => !checked.has(page.sheetId)).map((page) => page.sheetId);
}
