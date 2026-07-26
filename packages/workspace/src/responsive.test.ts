import { describe, expect, it } from 'vitest';
import { LAYOUT_SLOTS } from './registry';
import {
  availableCanvasWidthPx,
  resolveLayoutSlotId,
  resolveLayoutSlots,
  resolvePanelOverflowRelief,
  resolveWorkspacePlatform,
  type CanvasWidthInput,
} from './responsive';

describe('resolveWorkspacePlatform', () => {
  it('classifies the QA fixture viewports', () => {
    expect(resolveWorkspacePlatform({ widthPx: 1920, heightPx: 1080, coarsePointer: false })).toBe(
      'desktop',
    );
    expect(resolveWorkspacePlatform({ widthPx: 1536, heightPx: 864, coarsePointer: false })).toBe(
      'desktop',
    );
    expect(resolveWorkspacePlatform({ widthPx: 1366, heightPx: 768, coarsePointer: false })).toBe(
      'desktop',
    );
    expect(resolveWorkspacePlatform({ widthPx: 1024, heightPx: 768, coarsePointer: false })).toBe(
      'compact-desktop',
    );
    expect(resolveWorkspacePlatform({ widthPx: 1194, heightPx: 834, coarsePointer: true })).toBe(
      'tablet-landscape',
    );
    expect(resolveWorkspacePlatform({ widthPx: 834, heightPx: 1194, coarsePointer: true })).toBe(
      'tablet-portrait',
    );
    expect(resolveWorkspacePlatform({ widthPx: 393, heightPx: 852, coarsePointer: true })).toBe(
      'phone',
    );
    expect(resolveWorkspacePlatform({ widthPx: 412, heightPx: 915, coarsePointer: true })).toBe(
      'phone',
    );
  });

  /**
   * The reference contract's rule: "Device names are presentation guidance
   * only. Layout selection is content/pointer capability driven." A touchscreen
   * laptop is not a tablet, and an iPad at desktop width is not a desktop just
   * because it is wide.
   */
  it('is driven by pointer capability, not device identity', () => {
    // Same 1194x834 box, fine pointer: a small laptop window, not an iPad.
    expect(resolveWorkspacePlatform({ widthPx: 1194, heightPx: 834, coarsePointer: false })).toBe(
      'compact-desktop',
    );
    // Coarse pointer at desktop width still gets the desktop layout.
    expect(resolveWorkspacePlatform({ widthPx: 1600, heightPx: 900, coarsePointer: true })).toBe(
      'desktop',
    );
  });

  it('treats a narrow window as a phone regardless of pointer', () => {
    expect(resolveWorkspacePlatform({ widthPx: 420, heightPx: 900, coarsePointer: false })).toBe(
      'phone',
    );
  });
});

describe('resolveLayoutSlotId', () => {
  it('only ever names a layout the registry defines', () => {
    const probes = [
      { widthPx: 1920, heightPx: 1080, coarsePointer: false },
      { widthPx: 1536, heightPx: 864, coarsePointer: false },
      { widthPx: 1366, heightPx: 768, coarsePointer: false },
      { widthPx: 1024, heightPx: 768, coarsePointer: false },
      { widthPx: 1194, heightPx: 834, coarsePointer: true },
      { widthPx: 834, heightPx: 1194, coarsePointer: true },
      { widthPx: 393, heightPx: 852, coarsePointer: true },
    ] as const;
    for (const probe of probes) {
      const id = resolveLayoutSlotId(resolveWorkspacePlatform(probe), probe.widthPx);
      expect(Object.keys(LAYOUT_SLOTS)).toContain(id);
      expect(() => resolveLayoutSlots(probe)).not.toThrow();
    }
  });

  it('separates the 1536 and 1920 desktop slot sets', () => {
    expect(resolveLayoutSlotId('desktop', 1536)).toBe('desktop1536');
    expect(resolveLayoutSlotId('desktop', 1920)).toBe('wide1920');
  });
});

const DESKTOP_1536 = LAYOUT_SLOTS.desktop1536!;

function canvasInput(overrides: Partial<CanvasWidthInput> = {}): CanvasWidthInput {
  return {
    viewportWidthPx: 1536,
    slots: DESKTOP_1536,
    leftPanelOpen: true,
    rightPanelOpen: true,
    leftPanelWidthPx: 268,
    rightPanelWidthPx: 292,
    ...overrides,
  };
}

describe('availableCanvasWidthPx', () => {
  it('subtracts both rails and both docked panels', () => {
    // 1536 - 48 mode rail - 48 tool rail - 268 browser - 292 inspector
    expect(availableCanvasWidthPx(canvasInput())).toBe(880);
  });

  it('gives the width back when a panel floats', () => {
    expect(availableCanvasWidthPx(canvasInput({ rightPanelOpen: false }))).toBe(1172);
  });
});

describe('resolvePanelOverflowRelief', () => {
  it('leaves both panels docked at the 1536 baseline', () => {
    expect(resolvePanelOverflowRelief(canvasInput())).toBe('none');
  });

  it('floats the inspector before the browser when the canvas floor is breached', () => {
    // 1100 - 96 rails - 268 - 292 = 444, under the 620 minimum.
    expect(resolvePanelOverflowRelief(canvasInput({ viewportWidthPx: 1100 }))).toBe(
      'float-right-panel',
    );
  });

  it('floats both panels when floating the inspector is not enough', () => {
    // 900 - 96 - 268 = 536, still under 620 with the inspector already floated.
    expect(resolvePanelOverflowRelief(canvasInput({ viewportWidthPx: 900 }))).toBe(
      'float-both-panels',
    );
  });

  /**
   * Doc 36's floor is about real widths, not breakpoints: a user who drags the
   * browser out to its 384 px maximum hits the floor at a viewport where the
   * default 268 px width was still fine.
   */
  it('accounts for a user-widened browser panel', () => {
    expect(resolvePanelOverflowRelief(canvasInput({ viewportWidthPx: 1300 }))).toBe('none');
    expect(
      resolvePanelOverflowRelief(canvasInput({ viewportWidthPx: 1300, leftPanelWidthPx: 384 })),
    ).toBe('float-right-panel');
  });

  /**
   * The floor is about the layout that is rendered, not the one the registry
   * describes. This repository's rails are 312px (112 mode + 200 tool) against
   * the registry's 96px allowance, and a floor fed the registry number stays
   * silent while the real canvas is already under its minimum.
   */
  it('fires on the rendered rail width, not the registry allowance', () => {
    const input = canvasInput({ viewportWidthPx: 1400 });
    expect(availableCanvasWidthPx(input)).toBe(744);
    expect(resolvePanelOverflowRelief(input)).toBe('none');

    const rendered = canvasInput({ viewportWidthPx: 1400, railsWidthPx: 312 });
    expect(availableCanvasWidthPx(rendered)).toBe(528);
    expect(resolvePanelOverflowRelief(rendered)).toBe('float-right-panel');
  });

  it('does nothing for layouts with no declared canvas minimum', () => {
    const tablet = LAYOUT_SLOTS.ipadLandscape1194x834!;
    expect(resolvePanelOverflowRelief(canvasInput({ slots: tablet, viewportWidthPx: 400 }))).toBe(
      'none',
    );
  });
});
