import { describe, expect, it } from 'vitest';
import {
  INITIAL_PANEL_LAYOUT_STATE,
  occupiesLayoutWidth,
  reconcileDockedPanels,
} from './panel-layout-state';
import { resolveLayoutSlots } from './responsive';

const DESKTOP = {
  viewportWidthPx: 1600,
  slots: resolveLayoutSlots({ widthPx: 1600, heightPx: 1000, coarsePointer: false }),
  platform: 'desktop' as const,
  railsWidthPx: 328,
};

describe('floating composition', () => {
  it('takes no canvas width for either panel', () => {
    // The point of the whole composition: the drawing runs the full width of
    // the workspace and the panels rest on top of it.
    const state = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      ...DESKTOP,
      composition: 'floating',
    });

    expect(occupiesLayoutWidth(state, 'project-browser')).toBe(false);
    expect(occupiesLayoutWidth(state, 'inspector')).toBe(false);
  });

  it('keeps both panels open - floating is a presentation, not a dismissal', () => {
    const state = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      ...DESKTOP,
      composition: 'floating',
    });

    expect(state['project-browser'].open).toBe(true);
    expect(state.inspector.open).toBe(true);
  });

  it('floats them even when there is ample room to dock', () => {
    // The distinction from overflow relief: that logic floats panels because
    // they stopped fitting, and would re-dock them the moment they fit again.
    const roomy = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      ...DESKTOP,
      viewportWidthPx: 2560,
      composition: 'floating',
    });

    expect(occupiesLayoutWidth(roomy, 'project-browser')).toBe(false);
  });

  it('leaves the docked composition exactly as it was', () => {
    // Default and omitted must be identical, so every existing caller and test
    // describes the same behaviour it always did.
    const omitted = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, DESKTOP);
    const explicit = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      ...DESKTOP,
      composition: 'docked',
    });

    expect(explicit).toEqual(omitted);
    expect(occupiesLayoutWidth(omitted, 'project-browser')).toBe(true);
  });

  it('still closes both panels on a touch band, whatever the composition asks for', () => {
    // Doc 46's drawers-only rule outranks a composition preference: a phone has
    // no room for a floating panel either.
    const phone = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 430,
      slots: resolveLayoutSlots({ widthPx: 430, heightPx: 932, coarsePointer: true }),
      platform: 'phone',
      composition: 'floating',
    });

    expect(phone['project-browser'].open).toBe(false);
    expect(phone.inspector.open).toBe(false);
  });
});
