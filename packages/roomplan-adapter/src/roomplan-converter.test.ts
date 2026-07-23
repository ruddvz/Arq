import { describe, expect, it } from 'vitest';
import { operationTypesUsed } from '@arq/arqscript';
import { convertCapturedRoomToArqScript, metersToMm } from './roomplan-converter';
import type { RoomPlanCapturedRoom } from './roomplan-captured-room';

describe('metersToMm', () => {
  it('converts metres to millimetres', () => {
    expect(metersToMm(1)).toBe(1000);
    expect(metersToMm(0.9)).toBeCloseTo(900);
  });
});

describe('convertCapturedRoomToArqScript', () => {
  it('converts a simple captured room (walls + a door) into ArqScript commands', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'wall-uuid-1',
          confidence: 'high',
          startMeters: { xMeters: 0, yMeters: 0 },
          endMeters: { xMeters: 4, yMeters: 0 },
          heightMeters: 2.4,
        },
      ],
      openings: [
        {
          identifier: 'door-uuid-1',
          kind: 'door',
          confidence: 'high',
          hostWallIdentifier: 'wall-uuid-1',
          widthMeters: 0.9,
          heightMeters: 2.1,
          offsetMeters: 1.2,
        },
      ],
    };

    const result = convertCapturedRoomToArqScript(room, 'scan-1');

    expect(result.document.scriptId).toBe('scan-1');
    expect(operationTypesUsed(result.document)).toEqual(['CreateWall', 'PlaceDoor']);
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0]).toMatchObject({
      scanObjectId: 'wall-uuid-1',
      confidence: 'high',
      command: {
        kind: 'wall',
        from: { xMm: 0, yMm: 0 },
        to: { xMm: 4000, yMm: 0 },
        heightMm: 2400,
      },
    });
    expect(result.elements[1]).toMatchObject({
      scanObjectId: 'door-uuid-1',
      command: {
        kind: 'door',
        hostWallId: 'wall-uuid-1',
        widthMm: 900,
        heightMm: 2100,
        offsetMm: 1200,
      },
    });
    expect(result.failedElements).toEqual([]);
  });

  it('converts a window opening', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'w1',
          confidence: 'high',
          startMeters: { xMeters: 0, yMeters: 0 },
          endMeters: { xMeters: 3, yMeters: 0 },
          heightMeters: 2.4,
        },
      ],
      openings: [
        {
          identifier: 'win1',
          kind: 'window',
          confidence: 'medium',
          hostWallIdentifier: 'w1',
          widthMeters: 1.2,
          heightMeters: 1.2,
          offsetMeters: 1,
        },
      ],
    };

    const result = convertCapturedRoomToArqScript(room, 'scan-2');
    expect(result.elements[1]?.command).toMatchObject({
      kind: 'window',
      widthMm: 1200,
      heightMm: 1200,
    });
  });

  it('translates negative RoomPlan world-space coordinates to a non-negative origin (real ARKit captures are routinely negative)', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'w1',
          confidence: 'high',
          startMeters: { xMeters: -2, yMeters: -1 },
          endMeters: { xMeters: 2, yMeters: -1 },
          heightMeters: 2.4,
        },
      ],
      openings: [],
    };

    const result = convertCapturedRoomToArqScript(room, 'scan-3');
    expect(result.originMeters).toEqual({ xMeters: -2, yMeters: -1 });
    expect(result.elements[0]?.command).toMatchObject({
      from: { xMm: 0, yMm: 0 },
      to: { xMm: 4000, yMm: 0 },
    });
    expect(result.failedElements).toEqual([]);
  });

  it('reports a low-confidence element without hiding or dropping it', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'w1',
          confidence: 'low',
          startMeters: { xMeters: 0, yMeters: 0 },
          endMeters: { xMeters: 1, yMeters: 0 },
          heightMeters: 2.4,
        },
      ],
      openings: [],
    };

    const result = convertCapturedRoomToArqScript(room, 'scan-4');
    expect(result.lowConfidenceElementIds).toEqual(['w1']);
    expect(result.elements).toHaveLength(1);
  });

  it('does not flag a high-confidence element as low-confidence', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'w1',
          confidence: 'high',
          startMeters: { xMeters: 0, yMeters: 0 },
          endMeters: { xMeters: 1, yMeters: 0 },
          heightMeters: 2.4,
        },
      ],
      openings: [],
    };

    expect(convertCapturedRoomToArqScript(room, 'scan-5').lowConfidenceElementIds).toEqual([]);
  });

  it('records a failed element without aborting the rest of the conversion', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'good-wall',
          confidence: 'high',
          startMeters: { xMeters: 0, yMeters: 0 },
          endMeters: { xMeters: 3, yMeters: 0 },
          heightMeters: 2.4,
        },
      ],
      openings: [
        {
          identifier: 'bad-door',
          kind: 'door',
          confidence: 'high',
          hostWallIdentifier: '', // empty host - createDoorCommand rejects this
          widthMeters: 0.9,
          heightMeters: 2.1,
          offsetMeters: 1,
        },
      ],
    };

    const result = convertCapturedRoomToArqScript(room, 'scan-6');
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.scanObjectId).toBe('good-wall');
    expect(result.failedElements).toEqual([
      { scanObjectId: 'bad-door', reason: expect.any(String) },
    ]);
  });

  it('returns an empty-but-valid result for an empty captured room', () => {
    const result = convertCapturedRoomToArqScript({ walls: [], openings: [] }, 'scan-7');
    expect(result.document.commands).toEqual([]);
    expect(result.elements).toEqual([]);
    expect(result.failedElements).toEqual([]);
    expect(result.originMeters).toEqual({ xMeters: 0, yMeters: 0 });
  });

  it('every converted command carries a matching scanObjectId for source provenance (section 109 step 11)', () => {
    const room: RoomPlanCapturedRoom = {
      walls: [
        {
          identifier: 'wall-provenance-test',
          confidence: 'high',
          startMeters: { xMeters: 0, yMeters: 0 },
          endMeters: { xMeters: 1, yMeters: 0 },
          heightMeters: 2.4,
        },
      ],
      openings: [],
    };

    const result = convertCapturedRoomToArqScript(room, 'scan-8');
    const element = result.elements[0];
    expect(element?.scanObjectId).toBe('wall-provenance-test');
    expect(element?.command.kind === 'wall' && element.command.id).toBe('wall-provenance-test');
  });
});
