import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  buildRoomLabelPrimitive,
  roomLabelAreaLine,
  roomLabelFits,
  roomLabelNameLine,
  roomLabelText,
  type RoomLabelSource,
} from './room-label';

const source: RoomLabelSource<string> = {
  elementId: 'room-1',
  seedPoint: worldPoint(1200, 800),
  name: 'Kitchen',
  areaSquareMetres: 12.345,
};

describe('roomLabelNameLine', () => {
  it('is just the name when there is no room number', () => {
    expect(roomLabelNameLine(source)).toBe('Kitchen');
  });

  it('prefixes the number when present', () => {
    expect(roomLabelNameLine({ ...source, number: '101' })).toBe('101 Kitchen');
  });
});

describe('roomLabelAreaLine', () => {
  it('formats the area to one decimal place with an m² suffix', () => {
    expect(roomLabelAreaLine(source)).toBe('12.3 m²');
  });

  it('rounds up when the second decimal is 5 or more', () => {
    expect(roomLabelAreaLine({ ...source, areaSquareMetres: 9.96 })).toBe('10.0 m²');
  });
});

describe('roomLabelText', () => {
  it('combines the name line and area line, separated by a newline', () => {
    expect(roomLabelText(source)).toBe('Kitchen\n12.3 m²');
  });

  it('includes the room number when present', () => {
    expect(roomLabelText({ ...source, number: '101' })).toBe('101 Kitchen\n12.3 m²');
  });
});

describe('buildRoomLabelPrimitive', () => {
  it('anchors the label at the room seedPoint and carries the given styleToken', () => {
    const primitive = buildRoomLabelPrimitive(source, 'default');
    expect(primitive).toEqual({
      kind: 'text',
      elementId: 'room-1',
      anchor: worldPoint(1200, 800),
      text: 'Kitchen\n12.3 m²',
      styleToken: 'default',
    });
  });

  it('carries whichever styleToken the caller resolved (e.g. selected-primary)', () => {
    const primitive = buildRoomLabelPrimitive(source, 'selected-primary');
    expect(primitive.styleToken).toBe('selected-primary');
  });
});

describe('roomLabelFits', () => {
  it('draws a label the room has room for', () => {
    expect(
      roomLabelFits({
        labelWidthPx: 60,
        labelHeightPx: 24,
        roomWidthPx: 200,
        roomHeightPx: 140,
      }),
    ).toBe(true);
  });

  it('suppresses a label wider than the room it names', () => {
    // The golden fixture's galleries on a phone: a few millimetres of room and
    // a label wider than all of it. Three overlapped into an unreadable smear
    // that also hid the walls underneath.
    expect(
      roomLabelFits({ labelWidthPx: 120, labelHeightPx: 24, roomWidthPx: 40, roomHeightPx: 140 }),
    ).toBe(false);
  });

  it('suppresses a label taller than the room, not only a wider one', () => {
    expect(
      roomLabelFits({ labelWidthPx: 40, labelHeightPx: 24, roomWidthPx: 200, roomHeightPx: 20 }),
    ).toBe(false);
  });

  it('keeps clear space, so a label never reads as touching the walls beside it', () => {
    // Exactly as wide as the room is not a fit: it would sit hard against both
    // walls with no gap at all.
    expect(
      roomLabelFits({ labelWidthPx: 100, labelHeightPx: 20, roomWidthPx: 100, roomHeightPx: 100 }),
    ).toBe(false);
  });

  it('refuses a measurement it cannot trust rather than drawing on a guess', () => {
    expect(
      roomLabelFits({
        labelWidthPx: Number.NaN,
        labelHeightPx: 20,
        roomWidthPx: 500,
        roomHeightPx: 500,
      }),
    ).toBe(false);
    expect(
      roomLabelFits({ labelWidthPx: 0, labelHeightPx: 20, roomWidthPx: 500, roomHeightPx: 500 }),
    ).toBe(false);
  });
});
