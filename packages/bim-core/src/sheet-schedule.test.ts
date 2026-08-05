import { describe, expect, it } from 'vitest';
import type { ScheduleId, SheetId } from './ids';
import { createSchedule, type ScheduleDefinition } from './schedule';
import {
  DEFAULT_SCHEDULE_METRICS,
  continuationText,
  paginateSchedule,
  paginationIsComplete,
  rowsPerPage,
  type SchedulePlacement,
} from './sheet-schedule';

const SCHEDULE: ScheduleDefinition = createSchedule({
  id: 'schedule-1' as ScheduleId,
  name: 'Door schedule',
  category: 'Door',
  fields: [{ key: 'mark', heading: 'Mark', source: 'instance' }],
});

/** 8mm header + 6mm rows: 100mm holds 15 rows without a marker, 15 with (5mm marker leaves 87mm). */
function placement(availableHeightMm: number, sheetId = 'sheet-1'): SchedulePlacement {
  return {
    scheduleId: SCHEDULE.id,
    sheetId: sheetId as SheetId,
    position: { x: 20, y: 20 },
    widthMm: 180,
    availableHeightMm,
  };
}

function sheets(...ids: string[]) {
  return ids.map((id) => id as SheetId);
}

describe('rowsPerPage', () => {
  it('allows for the header', () => {
    // 100mm - 8mm header = 92mm, at 6mm a row.
    expect(rowsPerPage(100, DEFAULT_SCHEDULE_METRICS, false)).toBe(15);
  });

  it('allows for the continuation marker on a page that continues', () => {
    // A page that fits exactly N rows and then has to say "continued" fits
    // fewer, and getting this wrong pushes the marker off the page.
    expect(rowsPerPage(100, DEFAULT_SCHEDULE_METRICS, true)).toBe(14);
  });

  it('is zero when not even a header and one row fit', () => {
    expect(rowsPerPage(10, DEFAULT_SCHEDULE_METRICS, false)).toBe(0);
  });
});

describe('paginateSchedule', () => {
  it('places a schedule that fits on one sheet', () => {
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 10,
      placement: placement(100),
      continuationSheetIds: [],
    });

    expect(result.status).toBe('placed');
    if (result.status !== 'placed') return;
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toMatchObject({ rowCount: 10, continues: false });
  });

  it('repeats the header on every page', () => {
    // A second page with no heading row is a table nobody can read on its own,
    // which is the situation someone on site is in with one page of a set.
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 30,
      placement: placement(100),
      continuationSheetIds: sheets('sheet-2', 'sheet-3'),
    });

    expect(result.status).toBe('placed');
    if (result.status !== 'placed') return;
    expect(result.pages.every((page) => page.repeatsHeader)).toBe(true);
  });

  it('paginates across continuation sheets without dropping a row', () => {
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 30,
      placement: placement(100),
      continuationSheetIds: sheets('sheet-2', 'sheet-3'),
    });

    expect(result.status).toBe('placed');
    if (result.status !== 'placed') return;
    expect(result.pages.reduce((total, page) => total + page.rowCount, 0)).toBe(30);
    expect(paginationIsComplete(result, 30)).toBe(true);
  });

  it('numbers rows continuously across pages', () => {
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 30,
      placement: placement(100),
      continuationSheetIds: sheets('sheet-2', 'sheet-3'),
    });

    if (result.status !== 'placed') return;
    let expectedFirst = 0;
    for (const page of result.pages) {
      expect(page.firstRow).toBe(expectedFirst);
      expectedFirst += page.rowCount;
    }
  });

  it('marks every page but the last as continuing', () => {
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 30,
      placement: placement(100),
      continuationSheetIds: sheets('sheet-2', 'sheet-3'),
    });

    if (result.status !== 'placed') return;
    const last = result.pages[result.pages.length - 1];
    expect(result.pages.slice(0, -1).every((page) => page.continues)).toBe(true);
    expect(last?.continues).toBe(false);
  });

  it('refuses rather than truncating when the rows run out of sheets', () => {
    // A table that ends at the bottom of the page and looks finished is a
    // procurement error: somebody orders the doors that fit on the page.
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 100,
      placement: placement(100),
      continuationSheetIds: [],
    });

    expect(result.status).toBe('overflow');
    if (result.status !== 'overflow') return;
    expect(result.unplacedRowCount).toBe(86);
  });

  it('says how many further sheets would hold the rest', () => {
    // The number somebody has to act on, rather than "does not fit".
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 100,
      placement: placement(100),
      continuationSheetIds: [],
    });

    expect(result.status).toBe('overflow');
    if (result.status !== 'overflow') return;
    expect(result.furtherSheetsNeeded).toBe(Math.ceil(86 / 14));
    expect(result.detail).toContain('further sheet');
  });

  it('reports overflow as incomplete', () => {
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 100,
      placement: placement(100),
      continuationSheetIds: [],
    });

    expect(paginationIsComplete(result, 100)).toBe(false);
  });

  it('cannot place a schedule in a space too small for a header and one row', () => {
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 5,
      placement: placement(10),
      continuationSheetIds: sheets('sheet-2'),
    });

    expect(result.status).toBe('cannot-place');
    if (result.status !== 'cannot-place') return;
    expect(result.detail).toContain('header and one row');
  });

  it('places an empty schedule rather than printing nothing', () => {
    // A door schedule with no doors is a meaningful statement on a drawing;
    // printing nothing where one was asked for looks like a fault.
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 0,
      placement: placement(100),
      continuationSheetIds: [],
    });

    expect(result.status).toBe('placed');
    if (result.status !== 'placed') return;
    expect(result.pages).toEqual([
      {
        sheetId: 'sheet-1',
        pageIndex: 0,
        firstRow: 0,
        rowCount: 0,
        repeatsHeader: true,
        continues: false,
      },
    ]);
  });

  it('uses the full page height on a last page that needs no marker', () => {
    // 15 rows fit without a marker; 14 with. A schedule of exactly 15 should
    // be one page, not two.
    const result = paginateSchedule({
      schedule: SCHEDULE,
      rowCount: 15,
      placement: placement(100),
      continuationSheetIds: sheets('sheet-2'),
    });

    expect(result.status).toBe('placed');
    if (result.status !== 'placed') return;
    expect(result.pages).toHaveLength(1);
  });
});

describe('continuationText', () => {
  it('says what follows, so a reader with a middle page knows there is more', () => {
    const text = continuationText(
      SCHEDULE,
      {
        sheetId: 'sheet-1' as SheetId,
        pageIndex: 0,
        firstRow: 0,
        rowCount: 14,
        repeatsHeader: true,
        continues: true,
      },
      3,
    );

    expect(text).toBe('Door schedule continues on the next sheet (1 of 3)');
  });

  it('says the schedule ended, so a reader with the last page knows they have the end', () => {
    const text = continuationText(
      SCHEDULE,
      {
        sheetId: 'sheet-3' as SheetId,
        pageIndex: 2,
        firstRow: 28,
        rowCount: 2,
        repeatsHeader: true,
        continues: false,
      },
      3,
    );

    expect(text).toBe('End of Door schedule (3 of 3)');
  });
});
