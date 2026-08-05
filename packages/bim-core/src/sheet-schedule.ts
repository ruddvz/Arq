import type { ScheduleDefinition } from './schedule';
import type { ScheduleId, SheetId } from './ids';

/**
 * V3-133: a schedule placed on a sheet, and what happens when it does not fit.
 *
 * `schedule.ts` holds the question and never the answer, which is right for the
 * definition. A sheet has to hold something more awkward: a schedule is
 * unbounded and a sheet is 594mm tall, and every drawing set eventually has a
 * door schedule longer than one page.
 *
 * The failure worth designing against is not the layout. It is a table that
 * ends at the bottom of the page and looks finished. A reader has no way to
 * know whether a 42-row door schedule stopped at 42 doors or at the page, and
 * an issued drawing set where the schedule silently ends mid-way is a
 * procurement error waiting to happen - somebody orders the doors that fit on
 * the page.
 *
 * So a placement that overflows is not truncated. It either paginates across
 * further sheets, which requires those sheets to exist and be named, or it
 * reports that it does not fit and gets placed nowhere. `ScheduleOverflow` is a
 * refusal with a count, not a silently shortened table.
 *
 * The header repeats on every page, and the continuation is stated. A second
 * page of a door schedule with no heading row and no "continued" marker is a
 * table nobody can read on its own, which is exactly the situation someone on
 * site is in when they have one page of a set.
 */

/** Where a schedule sits on a sheet, in paper millimetres. */
export interface SchedulePlacement {
  readonly scheduleId: ScheduleId;
  readonly sheetId: SheetId;
  readonly position: { readonly x: number; readonly y: number };
  readonly widthMm: number;
  /** How much vertical room the placement has on this sheet. */
  readonly availableHeightMm: number;
}

export interface ScheduleRowMetrics {
  readonly headerHeightMm: number;
  readonly rowHeightMm: number;
  /** Height of the "continued" marker, when one is drawn. */
  readonly continuationHeightMm: number;
}

/** Provisional: readable at 2.5mm text with ordinary table padding. Tune against a printed set. */
export const DEFAULT_SCHEDULE_METRICS: ScheduleRowMetrics = {
  headerHeightMm: 8,
  rowHeightMm: 6,
  continuationHeightMm: 5,
};

export interface SchedulePage {
  readonly sheetId: SheetId;
  readonly pageIndex: number;
  readonly firstRow: number;
  readonly rowCount: number;
  /** Always true. The header repeats because a page without one cannot be read alone. */
  readonly repeatsHeader: true;
  /** Whether more rows follow on another sheet, so a "continued" marker is drawn. */
  readonly continues: boolean;
}

export type SchedulePaginationResult =
  | { readonly status: 'placed'; readonly pages: readonly SchedulePage[] }
  | {
      readonly status: 'overflow';
      /** How many rows found no page. Never dropped quietly. */
      readonly unplacedRowCount: number;
      /** How many further sheets the rest would need. */
      readonly furtherSheetsNeeded: number;
      readonly detail: string;
    }
  | {
      readonly status: 'cannot-place';
      readonly detail: string;
    };

/**
 * How many rows fit in a height, allowing for the header and any continuation
 * marker.
 *
 * The marker's height is subtracted on any page that continues, because a page
 * that fits exactly N rows and then needs to say "continued" fits N-1. Getting
 * this wrong pushes the marker off the page, which produces the silent-ending
 * table this module exists to prevent.
 */
export function rowsPerPage(
  availableHeightMm: number,
  metrics: ScheduleRowMetrics,
  willContinue: boolean,
): number {
  const overhead = metrics.headerHeightMm + (willContinue ? metrics.continuationHeightMm : 0);
  const usable = availableHeightMm - overhead;
  if (usable < metrics.rowHeightMm) {
    return 0;
  }
  return Math.floor(usable / metrics.rowHeightMm);
}

export interface PaginateScheduleInput {
  readonly schedule: ScheduleDefinition;
  readonly rowCount: number;
  readonly placement: SchedulePlacement;
  /** Further sheets the rest may continue onto, in order. Empty when there are none. */
  readonly continuationSheetIds: readonly SheetId[];
  readonly metrics?: ScheduleRowMetrics;
}

/**
 * Lays a schedule out across a sheet and its continuations.
 *
 * Reports `overflow` rather than truncating when the rows run out of sheets,
 * and says how many further sheets would be needed - which is the number
 * somebody has to act on, and is much more useful than "does not fit".
 */
export function paginateSchedule(input: PaginateScheduleInput): SchedulePaginationResult {
  const metrics = input.metrics ?? DEFAULT_SCHEDULE_METRICS;
  const sheets = [input.placement.sheetId, ...input.continuationSheetIds];

  // Checked against a page that does not continue: if not even one row fits
  // without a marker, no arrangement of sheets helps.
  if (rowsPerPage(input.placement.availableHeightMm, metrics, false) === 0) {
    return {
      status: 'cannot-place',
      detail: `${input.placement.availableHeightMm}mm is not enough for a header and one row`,
    };
  }

  if (input.rowCount === 0) {
    // An empty schedule still places: a door schedule with no doors is a
    // meaningful statement on a drawing, and printing nothing where one was
    // asked for looks like a fault.
    return {
      status: 'placed',
      pages: [
        {
          sheetId: sheets[0] as SheetId,
          pageIndex: 0,
          firstRow: 0,
          rowCount: 0,
          repeatsHeader: true,
          continues: false,
        },
      ],
    };
  }

  const pages: SchedulePage[] = [];
  let placedRows = 0;
  let pageIndex = 0;

  while (placedRows < input.rowCount && pageIndex < sheets.length) {
    const sheetId = sheets[pageIndex];
    if (sheetId === undefined) {
      break;
    }

    const isLastAvailableSheet = pageIndex === sheets.length - 1;
    // Try the page as a non-continuing one first: if the remainder fits without
    // a marker, this is the last page and the marker is not needed.
    const withoutMarker = rowsPerPage(input.placement.availableHeightMm, metrics, false);
    const remaining = input.rowCount - placedRows;
    const finishesHere = remaining <= withoutMarker;

    const capacity = finishesHere
      ? withoutMarker
      : rowsPerPage(input.placement.availableHeightMm, metrics, true);

    if (capacity === 0) {
      break;
    }

    const rowCount = Math.min(capacity, remaining);
    pages.push({
      sheetId,
      pageIndex,
      firstRow: placedRows,
      rowCount,
      repeatsHeader: true,
      continues:
        !finishesHere && !(isLastAvailableSheet && placedRows + rowCount >= input.rowCount),
    });

    placedRows += rowCount;
    pageIndex += 1;
  }

  if (placedRows < input.rowCount) {
    const unplaced = input.rowCount - placedRows;
    const perContinuationPage = rowsPerPage(input.placement.availableHeightMm, metrics, true);
    const furtherSheetsNeeded =
      perContinuationPage > 0 ? Math.ceil(unplaced / perContinuationPage) : 0;
    return {
      status: 'overflow',
      unplacedRowCount: unplaced,
      furtherSheetsNeeded,
      detail: `${unplaced} rows do not fit; ${furtherSheetsNeeded} further sheet${furtherSheetsNeeded === 1 ? '' : 's'} would hold them`,
    };
  }

  return { status: 'placed', pages };
}

/**
 * A "continued" marker's text.
 *
 * Both halves matter. The last page says the schedule ended, so a reader
 * holding it knows they have the end; every other page says what follows, so a
 * reader holding one page in the middle knows they do not.
 */
export function continuationText(
  schedule: ScheduleDefinition,
  page: SchedulePage,
  totalPages: number,
): string {
  return page.continues
    ? `${schedule.name} continues on the next sheet (${page.pageIndex + 1} of ${totalPages})`
    : `End of ${schedule.name} (${page.pageIndex + 1} of ${totalPages})`;
}

/**
 * Whether every row of the schedule reached a page.
 *
 * The check a caller runs before issuing. It exists so "did the whole schedule
 * print" is answerable by something other than counting rows on paper.
 */
export function paginationIsComplete(result: SchedulePaginationResult, rowCount: number): boolean {
  if (result.status !== 'placed') {
    return false;
  }
  return result.pages.reduce((total, page) => total + page.rowCount, 0) === rowCount;
}
