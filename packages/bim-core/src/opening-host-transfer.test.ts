import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { length, toMillimetres } from './length';
import type { LevelId, OpeningId, WallId, WallTypeId } from './ids';
import type { Opening } from './opening';
import type { Wall } from './wall-instance';
import { splitWall } from './wall-split';
import {
  applyOpeningAssignments,
  openingsOrphanedByWallDeletion,
  openingsOutsideHost,
  transferOpeningsAcrossSplit,
} from './opening-host-transfer';

/** A 10m wall along the x axis, in world units read as millimetres. */
const WALL: Wall = {
  id: 'wall-1' as WallId,
  typeId: 'wall-type-1' as WallTypeId,
  levelId: 'level-1' as LevelId,
  alignment: 'centre',
  start: worldPoint(0, 0),
  end: worldPoint(10_000, 0),
  joinStart: 'auto',
  joinEnd: 'auto',
  hostedOpeningIds: ['door-a' as OpeningId, 'door-b' as OpeningId],
};

function opening(id: string, offsetMm: number, widthMm: number): Opening {
  return {
    id: id as OpeningId,
    hostWallId: WALL.id,
    kind: 'door',
    offsetFromWallStart: length(offsetMm, 'mm'),
    width: length(widthMm, 'mm'),
    sillHeight: length(0, 'mm'),
    height: length(2100, 'mm'),
  };
}

const SPLIT_POINT = worldPoint(5000, 0);

function splitAtMidpoint() {
  const result = splitWall(WALL, SPLIT_POINT, 'wall-2' as WallId, 1);
  if (result === null) {
    throw new Error('fixture split should succeed');
  }
  return result;
}

describe('transferOpeningsAcrossSplit', () => {
  it('keeps an opening wholly before the split on the first half, at the same offset', () => {
    const door = opening('door-a', 1000, 900);
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), [door], 1);

    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;
    expect(outcome.assignments).toEqual([
      {
        openingId: 'door-a',
        hostWallId: 'wall-1',
        offsetFromWallStart: length(1000, 'mm'),
      },
    ]);
    expect(outcome.first.hostedOpeningIds).toEqual(['door-a']);
    expect(outcome.second.hostedOpeningIds).toEqual([]);
  });

  it('re-measures an opening past the split from the second half its own start', () => {
    const door = opening('door-b', 7000, 900);
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), [door], 1);

    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;
    const assignment = outcome.assignments[0];
    expect(assignment?.hostWallId).toBe('wall-2');
    // 7000 from the original start is 2000 from the split point. Carrying 7000
    // across would place the door past the end of a 5m wall.
    expect(toMillimetres(assignment!.offsetFromWallStart)).toBe(2000);
  });

  it('never leaves an opening without a host', () => {
    // AC3-048's failure: an opening that stops being hosted is a detached mesh.
    const openings = [opening('door-a', 1000, 900), opening('door-b', 7000, 900)];
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), openings, 1);

    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;
    const hostedAfter = [...outcome.first.hostedOpeningIds, ...outcome.second.hostedOpeningIds];
    expect([...hostedAfter].sort()).toEqual(['door-a', 'door-b']);
    expect(outcome.assignments).toHaveLength(2);
  });

  it('blocks the split when an opening straddles it, rather than guessing', () => {
    const straddling = opening('door-c', 4500, 1000);
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), [straddling], 1);

    expect(outcome).toEqual({
      status: 'blocked',
      reason: 'opening-straddles-split',
      straddlingOpeningIds: ['door-c'],
    });
  });

  it('names every straddling opening so a message can list them', () => {
    const outcome = transferOpeningsAcrossSplit(
      WALL,
      splitAtMidpoint(),
      [opening('door-c', 4500, 1000), opening('door-d', 4900, 300), opening('door-a', 100, 900)],
      1,
    );

    expect(outcome.status).toBe('blocked');
    if (outcome.status !== 'blocked') return;
    expect(outcome.straddlingOpeningIds).toEqual(['door-c', 'door-d']);
  });

  it('treats an opening ending exactly at the split as belonging to the first half', () => {
    // openingFitsWallLength already treats landing on a boundary as valid;
    // calling it a straddle would block a geometrically fine split.
    const flush = opening('door-a', 4100, 900);
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), [flush], 1);

    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;
    expect(outcome.first.hostedOpeningIds).toEqual(['door-a']);
  });

  it('treats an opening starting exactly at the split as belonging to the second half', () => {
    const flush = opening('door-b', 5000, 900);
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), [flush], 1);

    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;
    expect(outcome.second.hostedOpeningIds).toEqual(['door-b']);
    expect(toMillimetres(outcome.assignments[0]!.offsetFromWallStart)).toBe(0);
  });

  it('ignores openings hosted on some other wall', () => {
    const elsewhere: Opening = { ...opening('door-x', 1000, 900), hostWallId: 'wall-9' as WallId };
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), [elsewhere], 1);

    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;
    expect(outcome.assignments).toEqual([]);
  });
});

describe('applyOpeningAssignments', () => {
  it('rewrites host and offset on the assigned openings only', () => {
    const openings = [opening('door-a', 1000, 900), opening('door-b', 7000, 900)];
    const outcome = transferOpeningsAcrossSplit(WALL, splitAtMidpoint(), openings, 1);
    expect(outcome.status).toBe('assigned');
    if (outcome.status !== 'assigned') return;

    const updated = applyOpeningAssignments(openings, outcome.assignments);

    expect(updated[0]?.hostWallId).toBe('wall-1');
    expect(updated[1]?.hostWallId).toBe('wall-2');
    expect(toMillimetres(updated[1]!.offsetFromWallStart)).toBe(2000);
  });

  it('leaves an opening with no assignment untouched', () => {
    const untouched = opening('door-z', 1000, 900);

    expect(applyOpeningAssignments([untouched], [])[0]).toBe(untouched);
  });
});

describe('openingsOrphanedByWallDeletion', () => {
  it('lists what a wall deletion takes with it, before it is gone', () => {
    const openings = [opening('door-a', 1000, 900), opening('door-b', 7000, 900)];

    expect(openingsOrphanedByWallDeletion(WALL.id, openings)).toEqual(['door-a', 'door-b']);
  });

  it('is empty for a wall that hosts nothing', () => {
    expect(openingsOrphanedByWallDeletion('wall-9' as WallId, [opening('door-a', 0, 900)])).toEqual(
      [],
    );
  });
});

describe('openingsOutsideHost', () => {
  it('reports a door left hanging past the end of a shortened wall', () => {
    const shortened: Wall = { ...WALL, end: worldPoint(3000, 0) };

    expect(openingsOutsideHost(shortened, [opening('door-b', 7000, 900)], 1)).toEqual(['door-b']);
  });

  it('accepts a door that still fits after the edit', () => {
    const shortened: Wall = { ...WALL, end: worldPoint(3000, 0) };

    expect(openingsOutsideHost(shortened, [opening('door-a', 1000, 900)], 1)).toEqual([]);
  });

  it('accepts a door ending exactly at the new wall end', () => {
    const shortened: Wall = { ...WALL, end: worldPoint(1900, 0) };

    expect(openingsOutsideHost(shortened, [opening('door-a', 1000, 900)], 1)).toEqual([]);
  });
});
