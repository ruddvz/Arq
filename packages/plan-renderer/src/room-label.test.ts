import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  buildRoomLabelPrimitive,
  roomLabelAreaLine,
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
