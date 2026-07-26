import { describe, expect, it } from 'vitest';
import { LAYOUT_SLOTS } from './registry';
import {
  INITIAL_PANEL_LAYOUT_STATE,
  clampPanelWidth,
  occupiesLayoutWidth,
  panelWidthBounds,
  reconcileDockedPanels,
  resizePanel,
  setPanelOpen,
  togglePanel,
} from './panel-layout-state';

const DESKTOP_1536 = LAYOUT_SLOTS.desktop1536!;
const DESKTOP_1024 = LAYOUT_SLOTS.desktop1024!;

describe('panelWidthBounds', () => {
  it('reads bounds from the panel registry, not from component CSS', () => {
    expect(panelWidthBounds('project-browser')).toEqual({ defaultWidth: 268, min: 232, max: 384 });
    expect(panelWidthBounds('inspector')).toEqual({ defaultWidth: 292, min: 248, max: 420 });
  });

  it('pins a panel the registry gives no range to a fixed width', () => {
    expect(panelWidthBounds('tasks')).toEqual({ defaultWidth: 360, min: 360, max: 360 });
  });
});

describe('clampPanelWidth', () => {
  it('clamps to the registry range', () => {
    expect(clampPanelWidth('project-browser', 100)).toBe(232);
    expect(clampPanelWidth('project-browser', 1000)).toBe(384);
    expect(clampPanelWidth('project-browser', 300)).toBe(300);
  });
});

describe('panel open/resize reducers', () => {
  it('toggles open state without touching presentation', () => {
    const next = togglePanel(INITIAL_PANEL_LAYOUT_STATE, 'inspector');
    expect(next.inspector.open).toBe(false);
    expect(next.inspector.mode).toBe('docked');
  });

  it('returns the same object when nothing changes', () => {
    expect(setPanelOpen(INITIAL_PANEL_LAYOUT_STATE, 'inspector', true)).toBe(
      INITIAL_PANEL_LAYOUT_STATE,
    );
    expect(resizePanel(INITIAL_PANEL_LAYOUT_STATE, 'inspector', 292)).toBe(
      INITIAL_PANEL_LAYOUT_STATE,
    );
  });

  it('starts secondary panels closed', () => {
    expect(INITIAL_PANEL_LAYOUT_STATE.review.open).toBe(false);
    expect(INITIAL_PANEL_LAYOUT_STATE.diagnostics.open).toBe(false);
  });
});

describe('reconcileDockedPanels', () => {
  it('keeps both panels docked at the 1536 baseline', () => {
    const next = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 1536,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(next.inspector.mode).toBe('docked');
    expect(next['project-browser'].mode).toBe('docked');
  });

  it('floats the inspector before the browser', () => {
    const next = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 1100,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(next.inspector.mode).toBe('overlay');
    expect(next['project-browser'].mode).toBe('docked');
  });

  /**
   * Doc 36 says turn the inspector into an overlay, not close it. Closing would
   * discard a preference the user set explicitly, so a window resize would be
   * destructive.
   */
  it('floats panels without closing them, and re-docks when room returns', () => {
    const narrow = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 900,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(narrow.inspector.open).toBe(true);
    expect(narrow['project-browser'].open).toBe(true);
    expect(narrow.inspector.mode).toBe('overlay');

    const widened = reconcileDockedPanels(narrow, {
      viewportWidthPx: 1600,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(widened.inspector.mode).toBe('docked');
    expect(widened['project-browser'].mode).toBe('docked');
  });

  it('preserves a user-chosen panel width across floating and re-docking', () => {
    const resized = resizePanel(INITIAL_PANEL_LAYOUT_STATE, 'inspector', 400);
    const narrow = reconcileDockedPanels(resized, {
      viewportWidthPx: 900,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    const widened = reconcileDockedPanels(narrow, {
      viewportWidthPx: 1600,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(widened.inspector.widthPx).toBe(400);
  });

  it('uses the rendered rail width when the host supplies one', () => {
    const registryWidths = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 1400,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(registryWidths.inspector.mode).toBe('docked');

    const renderedWidths = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 1400,
      slots: DESKTOP_1536,
      railsWidthPx: 312,
      platform: 'desktop',
    });
    expect(renderedWidths.inspector.mode).toBe('overlay');
  });

  /**
   * Doc 46: iPad portrait gets "No left+right desktop columns", iPad landscape
   * gets "transient drawers", phone gets "never squeezed side by side". These
   * layouts declare no canvasMinWidth, so treating a missing floor as "nothing
   * to reconcile" is exactly what left an 834px iPad rendering two docked
   * columns and a zero-width canvas.
   */
  it.each(['tablet-landscape', 'tablet-portrait', 'phone'] as const)(
    'closes and floats both panels on the %s band',
    (platform) => {
      const next = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
        viewportWidthPx: 834,
        slots: LAYOUT_SLOTS.ipadPortrait834x1194!,
        platform,
      });
      expect(next.inspector.mode).toBe('overlay');
      expect(next['project-browser'].mode).toBe('overlay');
      expect(next.inspector.open).toBe(false);
      expect(next['project-browser'].open).toBe(false);
      expect(occupiesLayoutWidth(next, 'inspector')).toBe(false);
      expect(occupiesLayoutWidth(next, 'project-browser')).toBe(false);
    },
  );

  it('keeps the browser docked but floats the inspector on compact desktop', () => {
    const next = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 1024,
      slots: DESKTOP_1024,
      platform: 'compact-desktop',
    });
    expect(next['project-browser'].mode).toBe('docked');
    expect(next.inspector.mode).toBe('overlay');
  });

  it('honours a layout that declares the right panel as an overlay outright', () => {
    const next = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 1024,
      slots: DESKTOP_1024,
      platform: 'compact-desktop',
    });
    expect(next.inspector.mode).toBe('overlay');
  });
});

describe('occupiesLayoutWidth', () => {
  it('is true only for an open docked panel', () => {
    expect(occupiesLayoutWidth(INITIAL_PANEL_LAYOUT_STATE, 'inspector')).toBe(true);
    const floated = reconcileDockedPanels(INITIAL_PANEL_LAYOUT_STATE, {
      viewportWidthPx: 900,
      slots: DESKTOP_1536,
      platform: 'desktop',
    });
    expect(occupiesLayoutWidth(floated, 'inspector')).toBe(false);
    expect(
      occupiesLayoutWidth(togglePanel(INITIAL_PANEL_LAYOUT_STATE, 'inspector'), 'inspector'),
    ).toBe(false);
  });
});
