import { describe, expect, it } from 'vitest';
import { createSheet, type CreateSheetInput, type SheetViewport } from './sheet';
import { projectId, sheetId, viewId } from './ids';
import { length } from './length';

const baseViewport: SheetViewport = {
  viewId: viewId('view-1'),
  scale: 0.01,
  position: { x: 20, y: 30 },
};

const baseInput: CreateSheetInput = {
  id: sheetId('sheet-1'),
  projectId: projectId('project-1'),
  number: 'A1.1',
  title: 'Level 1 Floor Plan',
  size: { kind: 'standard', name: 'A1' },
  viewport: baseViewport,
};

describe('createSheet', () => {
  it('constructs a sheet at revision 0', () => {
    const sheet = createSheet(baseInput);
    expect(sheet.revision).toBe(0);
    expect(sheet.number).toBe('A1.1');
    expect(sheet.title).toBe('Level 1 Floor Plan');
  });

  it('carries the single viewport through unchanged', () => {
    const sheet = createSheet(baseInput);
    expect(sheet.viewport).toEqual(baseViewport);
  });

  it('accepts a standard size', () => {
    const sheet = createSheet(baseInput);
    expect(sheet.size).toEqual({ kind: 'standard', name: 'A1' });
  });

  it('accepts a valid custom size', () => {
    const sheet = createSheet({
      ...baseInput,
      size: { kind: 'custom', width: length(841, 'mm'), height: length(594, 'mm') },
    });
    expect(sheet.size).toEqual({
      kind: 'custom',
      width: { value: 841, unit: 'mm' },
      height: { value: 594, unit: 'mm' },
    });
  });

  it('rejects a standard size with an empty name', () => {
    expect(() => createSheet({ ...baseInput, size: { kind: 'standard', name: '  ' } })).toThrow(
      /non-empty name/,
    );
  });

  it('rejects a custom size with a non-positive width', () => {
    expect(() =>
      createSheet({
        ...baseInput,
        size: { kind: 'custom', width: length(0, 'mm'), height: length(594, 'mm') },
      }),
    ).toThrow(/width/);
  });

  it('rejects a custom size with a non-finite height', () => {
    expect(() =>
      createSheet({
        ...baseInput,
        size: { kind: 'custom', width: length(841, 'mm'), height: length(Infinity, 'mm') },
      }),
    ).toThrow(/height/);
  });

  it('rejects a non-positive viewport scale', () => {
    expect(() => createSheet({ ...baseInput, viewport: { ...baseViewport, scale: 0 } })).toThrow(
      /scale/,
    );
  });

  it('rejects a non-finite viewport scale', () => {
    expect(() =>
      createSheet({ ...baseInput, viewport: { ...baseViewport, scale: Number.NaN } }),
    ).toThrow(/scale/);
  });
});
