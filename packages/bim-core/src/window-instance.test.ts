import { describe, expect, it } from 'vitest';
import { length } from './length';
import { levelId, openingId, wallId, windowId, windowTypeId } from './ids';
import { createWindowType } from './window-type';
import { createOpening } from './opening';
import {
  createWindow,
  flipWindowSide,
  resolveWindowHeight,
  resolveWindowSillHeight,
  resolveWindowWidth,
} from './window-instance';

const windowType = createWindowType({
  id: windowTypeId('wt-1'),
  name: 'Standard casement',
  defaultWidth: length(1200, 'mm'),
  defaultHeight: length(1200, 'mm'),
  defaultSillHeight: length(900, 'mm'),
});

const matchingOpening = createOpening({
  id: openingId('o-1'),
  hostWallId: wallId('w-1'),
  kind: 'window',
  offsetFromWallStart: length(500, 'mm'),
  width: length(1200, 'mm'),
  sillHeight: length(900, 'mm'),
  height: length(1200, 'mm'),
});

describe('createWindow', () => {
  it('constructs a window defaulting side to right', () => {
    const window = createWindow({
      id: windowId('w-1'),
      typeId: windowType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    expect(window.side).toBe('right');
  });

  it('accepts an explicit side', () => {
    const window = createWindow({
      id: windowId('w-1'),
      typeId: windowType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
      side: 'left',
    });
    expect(window.side).toBe('left');
  });
});

describe('flipWindowSide', () => {
  it('toggles side and preserves the id', () => {
    const window = createWindow({
      id: windowId('w-1'),
      typeId: windowType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    const flipped = flipWindowSide(window);
    expect(flipped.side).toBe('left');
    expect(flipped.id).toBe(window.id);
  });

  it('flipping twice returns to the original value', () => {
    const window = createWindow({
      id: windowId('w-1'),
      typeId: windowType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    expect(flipWindowSide(flipWindowSide(window))).toEqual(window);
  });
});

describe('resolveWindowWidth / resolveWindowHeight / resolveWindowSillHeight', () => {
  const window = createWindow({
    id: windowId('w-1'),
    typeId: windowType.id,
    openingId: matchingOpening.id,
    levelId: levelId('l-1'),
  });

  it('is Inherited for width, height, and sillHeight when the opening still matches the window type defaults', () => {
    expect(resolveWindowWidth(window, windowType, matchingOpening)).toEqual({
      kind: 'inherited',
      value: length(1200, 'mm'),
      sourceTypeId: 'wt-1',
    });
    expect(resolveWindowHeight(window, windowType, matchingOpening)).toEqual({
      kind: 'inherited',
      value: length(1200, 'mm'),
      sourceTypeId: 'wt-1',
    });
    expect(resolveWindowSillHeight(window, windowType, matchingOpening)).toEqual({
      kind: 'inherited',
      value: length(900, 'mm'),
      sourceTypeId: 'wt-1',
    });
  });

  it('is Overridden for width when the opening width differs from the window type default', () => {
    const widerOpening = createOpening({ ...matchingOpening, width: length(1500, 'mm') });
    expect(resolveWindowWidth(window, windowType, widerOpening)).toEqual({
      kind: 'overridden',
      value: length(1500, 'mm'),
      sourceTypeId: 'wt-1',
    });
  });

  it('is Overridden for sillHeight when the opening sill differs from the window type default', () => {
    const lowerOpening = createOpening({ ...matchingOpening, sillHeight: length(0, 'mm') });
    expect(resolveWindowSillHeight(window, windowType, lowerOpening)).toEqual({
      kind: 'overridden',
      value: length(0, 'mm'),
      sourceTypeId: 'wt-1',
    });
  });
});
