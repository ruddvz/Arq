import { describe, expect, it } from 'vitest';
import {
  CLOSED_SHEET_STATE,
  openSheet,
  phoneBottomOwner,
  SHEET_IDS,
  type SheetDetent,
} from './sheet-state';

const DETENTS: readonly SheetDetent[] = ['peek', 'half', 'full'];

describe('phoneBottomOwner', () => {
  it('gives the bottom to the review bar when nothing is raised', () => {
    expect(phoneBottomOwner(CLOSED_SHEET_STATE, 'phone', true)).toBe('review-bar');
  });

  it('hands the bottom to a raised sheet, at every detent', () => {
    // The regression this exists for is specifically the partial detents: at
    // `full` the sheet covered the dock anyway, so only `peek` and `half` ever
    // showed two competing rows of controls.
    for (const sheet of SHEET_IDS) {
      for (const detent of DETENTS) {
        const raised = { ...openSheet(CLOSED_SHEET_STATE, sheet), detent };

        expect(phoneBottomOwner(raised, 'phone', true), `${sheet} at ${detent}`).toBe('sheet');
      }
    }
  });

  it('never names two owners at once', () => {
    // The contract is an exclusive choice, so the property worth asserting is
    // that the function is total and single-valued rather than a pair of
    // independent booleans a caller could get both of.
    for (const sheet of [null, ...SHEET_IDS]) {
      const state = sheet === null ? CLOSED_SHEET_STATE : openSheet(CLOSED_SHEET_STATE, sheet);

      expect(['review-bar', 'sheet', 'none']).toContain(phoneBottomOwner(state, 'phone', true));
    }
  });

  it('claims no bottom owner away from the phone band', () => {
    for (const platform of ['desktop', 'tablet-landscape', 'tablet-portrait'] as const) {
      expect(phoneBottomOwner(CLOSED_SHEET_STATE, platform, true)).toBe('none');
    }
  });

  it('leaves the review bar owning the bottom when sheets are not the presentation', () => {
    // A band that raises side drawers instead never stacks anything, so the
    // sheet does not take the bottom away from the bar.
    const raised = openSheet(CLOSED_SHEET_STATE, 'inspector');

    expect(phoneBottomOwner(raised, 'phone', false)).toBe('review-bar');
  });
});
