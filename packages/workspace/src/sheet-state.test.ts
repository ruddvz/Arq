import { describe, expect, it } from 'vitest';
import {
  CLOSED_SHEET_STATE,
  SHEET_IDS,
  closeSheet,
  collapseSheet,
  detentForDraggedHeight,
  expandSheet,
  handleSystemBack,
  initialDetentFor,
  openSheet,
  panelForSheet,
  setDetent,
  sheetHeightPx,
  toggleSheet,
} from './sheet-state';

describe('openSheet', () => {
  /** Doc 47: "One primary task at a time." */
  it('raises exactly one sheet at a time', () => {
    const tools = openSheet(CLOSED_SHEET_STATE, 'tools');
    const inspector = openSheet(tools, 'inspector');
    expect(inspector.openSheet).toBe('inspector');
  });

  /** Doc 47: peek "shows selection identity + 2-3 highest-value properties". */
  it('opens the inspector at peek and everything else at half', () => {
    expect(openSheet(CLOSED_SHEET_STATE, 'inspector').detent).toBe('peek');
    expect(openSheet(CLOSED_SHEET_STATE, 'tools').detent).toBe('half');
    for (const sheet of SHEET_IDS) {
      expect(initialDetentFor(sheet)).not.toBe('closed');
    }
  });

  it('is a no-op when the sheet is already open, preserving its detent', () => {
    const expanded = expandSheet(openSheet(CLOSED_SHEET_STATE, 'inspector'));
    expect(expanded.detent).toBe('half');
    expect(openSheet(expanded, 'inspector')).toBe(expanded);
  });
});

describe('toggleSheet', () => {
  it('dismisses the sheet its own dock control reopens', () => {
    const open = toggleSheet(CLOSED_SHEET_STATE, 'tools');
    expect(open.openSheet).toBe('tools');
    expect(toggleSheet(open, 'tools')).toEqual(CLOSED_SHEET_STATE);
  });

  it('swaps rather than stacks when a different control is used', () => {
    const tools = toggleSheet(CLOSED_SHEET_STATE, 'tools');
    expect(toggleSheet(tools, 'review').openSheet).toBe('review');
  });
});

describe('detents', () => {
  it('walks peek -> half -> full and back, clamping at both ends', () => {
    let state = openSheet(CLOSED_SHEET_STATE, 'inspector');
    expect(state.detent).toBe('peek');
    state = expandSheet(state);
    expect(state.detent).toBe('half');
    state = expandSheet(state);
    expect(state.detent).toBe('full');
    expect(expandSheet(state).detent).toBe('full');

    state = collapseSheet(collapseSheet(state));
    expect(state.detent).toBe('peek');
  });

  /** Dragging below peek dismisses - the gesture users already know. */
  it('collapsing past peek dismisses the sheet', () => {
    const peeking = openSheet(CLOSED_SHEET_STATE, 'inspector');
    expect(collapseSheet(peeking)).toEqual(CLOSED_SHEET_STATE);
    expect(setDetent(peeking, 'closed')).toEqual(CLOSED_SHEET_STATE);
  });

  it('ignores detent changes when nothing is open', () => {
    expect(setDetent(CLOSED_SHEET_STATE, 'full')).toBe(CLOSED_SHEET_STATE);
    expect(expandSheet(CLOSED_SHEET_STATE)).toBe(CLOSED_SHEET_STATE);
  });
});

describe('handleSystemBack', () => {
  /**
   * Doc 47 > Gestures: "system back closes overlays first." The unconsumed case
   * matters just as much - swallowing back with nothing open traps an Android
   * user in the workspace.
   */
  it('closes an open sheet and reports the gesture consumed', () => {
    const open = openSheet(CLOSED_SHEET_STATE, 'review');
    const result = handleSystemBack(open);
    expect(result.consumed).toBe(true);
    expect(result.state).toEqual(CLOSED_SHEET_STATE);
  });

  it('does not consume back when no sheet is open', () => {
    const result = handleSystemBack(CLOSED_SHEET_STATE);
    expect(result.consumed).toBe(false);
    expect(result.state).toBe(CLOSED_SHEET_STATE);
  });
});

describe('sheetHeightPx', () => {
  it('uses the registry detents for the phone layout', () => {
    // iphone393x852 declares sheetDetents [300, 620, 790].
    expect(sheetHeightPx('phone', 'peek', 852)).toBe(300);
    expect(sheetHeightPx('phone', 'half', 852)).toBe(620);
    expect(sheetHeightPx('phone', 'full', 852)).toBe(790);
  });

  it('uses the registry detents for iPad portrait', () => {
    // ipadPortrait834x1194 declares bottomInspectorDetents [320, 650, 980].
    expect(sheetHeightPx('tablet-portrait', 'peek', 1194)).toBe(320);
    expect(sheetHeightPx('tablet-portrait', 'full', 1194)).toBe(980);
  });

  /**
   * Registry heights are authored against a reference device. A shorter window
   * must not get a sheet taller than itself.
   */
  it('never exceeds the viewport height', () => {
    expect(sheetHeightPx('phone', 'full', 500)).toBe(500);
  });

  it('falls back to viewport fractions where the layout declares no detents', () => {
    expect(sheetHeightPx('tablet-landscape', 'half', 1000)).toBe(680);
  });

  it('is zero when closed', () => {
    expect(sheetHeightPx('phone', 'closed', 852)).toBe(0);
  });
});

describe('detentForDraggedHeight', () => {
  // iphone393x852 declares sheetDetents [300, 620, 790].
  it('snaps to the nearest declared detent', () => {
    expect(detentForDraggedHeight('phone', 310, 852)).toBe('peek');
    expect(detentForDraggedHeight('phone', 500, 852)).toBe('half');
    // 700 sits 80 from half and 90 from full, so it snaps back to half.
    expect(detentForDraggedHeight('phone', 700, 852)).toBe('half');
    expect(detentForDraggedHeight('phone', 750, 852)).toBe('full');
    expect(detentForDraggedHeight('phone', 900, 852)).toBe('full');
  });

  /** Dragging a sheet most of the way off the bottom dismisses it. */
  it('dismisses below half the peek height', () => {
    expect(detentForDraggedHeight('phone', 149, 852)).toBe('closed');
    expect(detentForDraggedHeight('phone', 151, 852)).toBe('peek');
  });

  /**
   * Nearest rather than direction-based: a drag that overshoots and comes back
   * lands where the sheet visibly is, not where the gesture began.
   */
  it('is decided by where the sheet ended, not which way it moved', () => {
    const midway = (620 + 790) / 2;
    expect(detentForDraggedHeight('phone', midway - 10, 852)).toBe('half');
    expect(detentForDraggedHeight('phone', midway + 10, 852)).toBe('full');
  });
});

describe('panelForSheet', () => {
  it('maps the sheets that mirror a docked panel, and only those', () => {
    expect(panelForSheet('project-browser')).toBe('project-browser');
    expect(panelForSheet('inspector')).toBe('inspector');
    expect(panelForSheet('review')).toBe('review');
    expect(panelForSheet('tools')).toBeNull();
    expect(panelForSheet('view-switcher')).toBeNull();
  });
});

describe('closeSheet', () => {
  it('returns the closed state', () => {
    expect(closeSheet()).toEqual(CLOSED_SHEET_STATE);
  });
});
