import { describe, expect, it } from 'vitest';
import {
  dimensionId,
  doorId,
  doorTypeId,
  elementId,
  levelId,
  openingId,
  projectId,
  roomId,
  sheetId,
  textNoteId,
  viewId,
  wallId,
  wallTypeId,
  windowId,
  windowTypeId,
  type ProjectId,
  type WallId,
} from './ids';

describe('id constructors', () => {
  it('return the underlying string value unchanged at runtime', () => {
    expect(projectId('p1')).toBe('p1');
    expect(elementId('e1')).toBe('e1');
    expect(wallId('w1')).toBe('w1');
    expect(openingId('o1')).toBe('o1');
    expect(roomId('r1')).toBe('r1');
    expect(levelId('l1')).toBe('l1');
    expect(wallTypeId('t1')).toBe('t1');
    expect(doorId('d1')).toBe('d1');
    expect(doorTypeId('dt1')).toBe('dt1');
    expect(windowId('win1')).toBe('win1');
    expect(windowTypeId('wint1')).toBe('wint1');
    expect(dimensionId('dim1')).toBe('dim1');
    expect(textNoteId('tn1')).toBe('tn1');
    expect(viewId('v1')).toBe('v1');
    expect(sheetId('sh1')).toBe('sh1');
  });
});

describe('branding (type-level)', () => {
  it('does not allow a ProjectId to be used where a WallId is expected', () => {
    const project: ProjectId = projectId('p1');
    // @ts-expect-error - a ProjectId must not satisfy the WallId shape.
    const wrong: WallId = project;
    expect(wrong).toBeDefined();
  });
});
