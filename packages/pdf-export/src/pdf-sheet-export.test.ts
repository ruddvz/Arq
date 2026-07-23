import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createSheet, projectId, sheetId, viewId } from '@arq/bim-core';
import type { SheetViewportScene } from '@arq/plan-renderer';
import { exportSheetToPdf } from './pdf-sheet-export';

const sheet = createSheet({
  id: sheetId('sheet-1'),
  projectId: projectId('project-1'),
  number: 'A1.1',
  title: 'Level 1 Floor Plan',
  size: { kind: 'standard', name: 'A1' },
  viewport: { viewId: viewId('view-1'), scale: 0.01, position: { x: 20, y: 20 } },
});

const projectName = 'Hillside Residence';

const sceneWithEveryPrimitiveKind: SheetViewportScene<string> = {
  primitives: [
    {
      kind: 'line',
      elementId: 'wall-1',
      points: [
        { x: 10, y: 10 },
        { x: 200, y: 10 },
      ],
      styleToken: 'default',
    },
    {
      kind: 'polygon',
      elementId: 'room-1',
      points: [
        { x: 10, y: 10 },
        { x: 200, y: 10 },
        { x: 200, y: 200 },
      ],
      styleToken: 'selected-primary',
    },
    {
      kind: 'text',
      elementId: 'room-1',
      anchor: { x: 50, y: 50 },
      text: 'Kitchen',
      styleToken: 'default',
    },
    {
      kind: 'handle',
      elementId: 'room-1',
      point: { x: 200, y: 200 },
      styleToken: 'selected-primary',
    },
  ],
};

const A1_WIDTH_PT = 1683.78;
const A1_HEIGHT_PT = 2383.94;

describe('exportSheetToPdf', () => {
  it('produces bytes with a real PDF magic header', async () => {
    const bytes = await exportSheetToPdf({
      sheet,
      projectName,
      viewportScene: sceneWithEveryPrimitiveKind,
      pageWidthPt: A1_WIDTH_PT,
      pageHeightPt: A1_HEIGHT_PT,
    });
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('produces a single-page PDF at the requested page size', async () => {
    const bytes = await exportSheetToPdf({
      sheet,
      projectName,
      viewportScene: sceneWithEveryPrimitiveKind,
      pageWidthPt: A1_WIDTH_PT,
      pageHeightPt: A1_HEIGHT_PT,
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const size = loaded.getPage(0).getSize();
    expect(size.width).toBeCloseTo(A1_WIDTH_PT, 5);
    expect(size.height).toBeCloseTo(A1_HEIGHT_PT, 5);
  });

  it('sets the document title from the sheet title', async () => {
    const bytes = await exportSheetToPdf({
      sheet,
      projectName,
      viewportScene: sceneWithEveryPrimitiveKind,
      pageWidthPt: A1_WIDTH_PT,
      pageHeightPt: A1_HEIGHT_PT,
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe('Level 1 Floor Plan');
  });

  it('sets the document subject from project name, sheet number and revision', async () => {
    const bytes = await exportSheetToPdf({
      sheet,
      projectName,
      viewportScene: sceneWithEveryPrimitiveKind,
      pageWidthPt: A1_WIDTH_PT,
      pageHeightPt: A1_HEIGHT_PT,
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getSubject()).toBe('Hillside Residence - Sheet A1.1 - Rev 0');
  });

  it('produces a valid, loadable PDF for an empty scene', async () => {
    const bytes = await exportSheetToPdf({
      sheet,
      projectName,
      viewportScene: { primitives: [] },
      pageWidthPt: A1_WIDTH_PT,
      pageHeightPt: A1_HEIGHT_PT,
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('rejects a non-positive pageWidthPt', async () => {
    await expect(
      exportSheetToPdf({
        sheet,
        projectName,
        viewportScene: { primitives: [] },
        pageWidthPt: 0,
        pageHeightPt: 100,
      }),
    ).rejects.toThrow(/pageWidthPt/);
  });

  it('rejects a non-finite pageHeightPt', async () => {
    await expect(
      exportSheetToPdf({
        sheet,
        projectName,
        viewportScene: { primitives: [] },
        pageWidthPt: 100,
        pageHeightPt: Number.NaN,
      }),
    ).rejects.toThrow(/pageHeightPt/);
  });
});
