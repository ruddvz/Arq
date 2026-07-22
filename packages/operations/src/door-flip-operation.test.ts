import { describe, expect, it } from 'vitest';
import {
  createDoor,
  createDoorType,
  createOpening,
  doorId,
  doorTypeId,
  length,
  levelId,
  openingId,
  projectId,
  wallId,
  type Door,
} from '@arq/bim-core';
import { operationId } from './operation';
import { applyUpdateProperty } from './update-property-operation';
import { buildFlipDoorHandOperation, buildFlipDoorSideOperation } from './door-flip-operation';

const doorType = createDoorType({
  id: doorTypeId('dt-1'),
  name: 'Single leaf',
  defaultWidth: length(900, 'mm'),
  defaultHeight: length(2100, 'mm'),
});

const opening = createOpening({
  id: openingId('o-1'),
  hostWallId: wallId('w-1'),
  kind: 'door',
  offsetFromWallStart: length(500, 'mm'),
  width: length(900, 'mm'),
  sillHeight: length(0, 'mm'),
  height: length(2100, 'mm'),
});

const door: Door = createDoor({
  id: doorId('d-1'),
  typeId: doorType.id,
  openingId: opening.id,
  levelId: levelId('l-1'),
});

const params = {
  actorId: 'user-1',
  projectId: projectId('p1'),
  baseRevision: 0,
  timestamp: '2026-07-22T00:00:00.000Z',
};

describe('buildFlipDoorSideOperation / applyUpdateProperty', () => {
  it('flips a right-side door to left', () => {
    const operation = buildFlipDoorSideOperation({
      id: operationId('op-1'),
      ...params,
      door,
    });
    const { elements, result } = applyUpdateProperty<Door, 'side'>(
      [door],
      operation,
      operationId('op-1-inv'),
      1,
    );
    expect(elements[0]?.side).toBe('left');
    expect(result.status).toBe('applied');
  });

  it("does not touch the door's hand or any other field", () => {
    const operation = buildFlipDoorSideOperation({
      id: operationId('op-1'),
      ...params,
      door,
    });
    const { elements } = applyUpdateProperty<Door, 'side'>([door], operation, operationId('inv'), 1);
    expect(elements[0]?.hand).toBe(door.hand);
    expect(elements[0]?.id).toBe(door.id);
    expect(elements[0]?.openingId).toBe(door.openingId);
  });

  it('applying the inverse flips the side back', () => {
    const operation = buildFlipDoorSideOperation({
      id: operationId('op-1'),
      ...params,
      door,
    });
    const applied = applyUpdateProperty<Door, 'side'>([door], operation, operationId('inv'), 1);
    const inverseOp = applied.result.inverse as ReturnType<typeof buildFlipDoorSideOperation>;
    const reverted = applyUpdateProperty<Door, 'side'>(
      applied.elements,
      inverseOp,
      operationId('inv-inv'),
      1,
    );
    expect(reverted.elements[0]?.side).toBe('right');
  });

  it('rejects, leaving the door list unchanged, when the door does not exist', () => {
    const missingDoor: Door = { ...door, id: doorId('missing') };
    const operation = buildFlipDoorSideOperation({
      id: operationId('op-1'),
      ...params,
      door: missingDoor,
    });
    const { elements, result } = applyUpdateProperty<Door, 'side'>(
      [door],
      operation,
      operationId('inv'),
      1,
    );
    expect(elements).toEqual([door]);
    expect(result.status).toBe('rejected');
  });
});

describe('buildFlipDoorHandOperation / applyUpdateProperty', () => {
  it('flips a right-hand door to left', () => {
    const operation = buildFlipDoorHandOperation({
      id: operationId('op-1'),
      ...params,
      door,
    });
    const { elements } = applyUpdateProperty<Door, 'hand'>([door], operation, operationId('inv'), 1);
    expect(elements[0]?.hand).toBe('left');
  });

  it("does not touch the door's side or any other field", () => {
    const operation = buildFlipDoorHandOperation({
      id: operationId('op-1'),
      ...params,
      door,
    });
    const { elements } = applyUpdateProperty<Door, 'hand'>([door], operation, operationId('inv'), 1);
    expect(elements[0]?.side).toBe(door.side);
  });

  it('applying the inverse flips the hand back', () => {
    const operation = buildFlipDoorHandOperation({
      id: operationId('op-1'),
      ...params,
      door,
    });
    const applied = applyUpdateProperty<Door, 'hand'>([door], operation, operationId('inv'), 1);
    const inverseOp = applied.result.inverse as ReturnType<typeof buildFlipDoorHandOperation>;
    const reverted = applyUpdateProperty<Door, 'hand'>(
      applied.elements,
      inverseOp,
      operationId('inv-inv'),
      1,
    );
    expect(reverted.elements[0]?.hand).toBe('right');
  });

  it('flipping twice (side then side again via two operations) returns to the original value', () => {
    const first = buildFlipDoorHandOperation({ id: operationId('op-1'), ...params, door });
    const afterFirst = applyUpdateProperty<Door, 'hand'>([door], first, operationId('inv-1'), 1);
    const flippedDoor = afterFirst.elements[0]!;
    const second = buildFlipDoorHandOperation({ id: operationId('op-2'), ...params, door: flippedDoor });
    const afterSecond = applyUpdateProperty<Door, 'hand'>(
      afterFirst.elements,
      second,
      operationId('inv-2'),
      1,
    );
    expect(afterSecond.elements[0]?.hand).toBe(door.hand);
  });
});
