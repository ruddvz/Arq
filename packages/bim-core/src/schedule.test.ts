import { describe, expect, it } from 'vitest';
import type { ScheduleId } from './ids';
import { createSchedule, scheduleIsAffectedBy, type ScheduleField } from './schedule';

const id = 'schedule-1' as ScheduleId;

const MARK: ScheduleField = { key: 'mark', heading: 'Mark', source: 'instance' };
const WIDTH: ScheduleField = { key: 'width', heading: 'Width', source: 'type' };

function doorSchedule() {
  return createSchedule({
    id,
    name: 'Door schedule',
    category: 'Door',
    fields: [MARK, WIDTH],
    filters: [{ key: 'levelId', operator: 'equals', value: 'level-2' }],
    sorts: [{ key: 'mark', direction: 'ascending' }],
  });
}

describe('createSchedule', () => {
  it('stores the question and never the answer', () => {
    const schedule = doorSchedule();

    // The absence of a rows/computedAt field is the point: a schedule that
    // cached its output would be a second, staleable copy of the model.
    expect(schedule).not.toHaveProperty('rows');
    expect(schedule).not.toHaveProperty('computedAt');
  });

  it('rejects a schedule with no fields', () => {
    expect(() => createSchedule({ id, name: 'Blank', category: 'Door', fields: [] })).toThrow(
      RangeError,
    );
  });

  it('rejects a duplicate field key', () => {
    expect(() =>
      createSchedule({
        id,
        name: 'Door schedule',
        category: 'Door',
        fields: [MARK, { key: 'mark', heading: 'Reference', source: 'instance' }],
      }),
    ).toThrow(/duplicate schedule field key/);
  });

  it('rejects sorting on a key no column shows, which would read as an arbitrary order', () => {
    expect(() =>
      createSchedule({
        id,
        name: 'Door schedule',
        category: 'Door',
        fields: [MARK],
        sorts: [{ key: 'height', direction: 'ascending' }],
      }),
    ).toThrow(/not one of its fields/);
  });

  it('rejects grouping by a key no column shows', () => {
    expect(() =>
      createSchedule({
        id,
        name: 'Door schedule',
        category: 'Door',
        fields: [MARK],
        groupBy: 'levelId',
      }),
    ).toThrow(/not one of its fields/);
  });

  it('allows filtering on a property the table does not display', () => {
    // "Every door on level 2" is a level filter on a schedule with no level
    // column - ordinary practice, not a mistake.
    const schedule = doorSchedule();

    expect(schedule.filters[0]?.key).toBe('levelId');
    expect(schedule.fields.map((field) => field.key)).not.toContain('levelId');
  });
});

describe('scheduleIsAffectedBy', () => {
  it('ignores changes to another category', () => {
    expect(scheduleIsAffectedBy(doorSchedule(), 'Wall', ['mark'])).toBe(false);
  });

  it('ignores a change to a property it neither shows nor filters on', () => {
    expect(scheduleIsAffectedBy(doorSchedule(), 'Door', ['fireRating'])).toBe(false);
  });

  it('reacts to a change in a displayed column', () => {
    expect(scheduleIsAffectedBy(doorSchedule(), 'Door', ['width'])).toBe(true);
  });

  it('reacts to a change in a filtered key, because a row can appear or vanish', () => {
    expect(scheduleIsAffectedBy(doorSchedule(), 'Door', ['levelId'])).toBe(true);
  });
});
