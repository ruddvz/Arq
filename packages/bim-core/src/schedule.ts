import type { ScheduleId } from './ids';

/**
 * V3-087: ScheduleDefinition.
 *
 * A schedule is a view of the model, not a copy of it. That is the whole design
 * constraint here, and it decides every field below: a schedule stores the
 * *question* - which elements, which properties, in what order, grouped how -
 * and never the answer. The moment a schedule caches rows, the drawing set has
 * two versions of the same fact and the printed one is the stale one. Door
 * schedules that disagree with the plan are a real and expensive failure mode,
 * and the cheapest place to rule it out is the schema.
 *
 * So there is no `rows` field, no `computedAt`, no row count. Evaluating a
 * definition against a model is a separate concern in the layer that owns the
 * model; this module owns the definition and the checks that can be made
 * without one.
 *
 * `category` is a plain string, matching `IdentitySource.category` rather than
 * introducing a competing enum. The set of schedulable categories is decided by
 * the model, not by the schedule, and a second list here would drift from it.
 */

/** Where a column's value comes from. */
export type ScheduleFieldSource =
  /** A property on the element instance. */
  | 'instance'
  /** A property on the element's type, inherited by every instance of it. */
  | 'type'
  /** A value the model derives, e.g. a room's calculated area. */
  | 'calculated';

export interface ScheduleField {
  /** Property key, resolved against the element by the evaluator. */
  readonly key: string;
  /** Column heading. Distinct from `key` so a heading can be renamed without repointing the column. */
  readonly heading: string;
  readonly source: ScheduleFieldSource;
}

export type ScheduleSortDirection = 'ascending' | 'descending';

export interface ScheduleSort {
  readonly key: string;
  readonly direction: ScheduleSortDirection;
}

/**
 * A filter on which elements appear.
 *
 * The operator set is small on purpose. Every operator added here is one the
 * evaluator, the exporter and any future interop layer all have to agree on
 * exactly, and a filter language that grows before it has a second consumer
 * grows in whichever direction the first caller happened to need.
 */
export type ScheduleFilterOperator = 'equals' | 'not-equals' | 'greater-than' | 'less-than';

export interface ScheduleFilter {
  readonly key: string;
  readonly operator: ScheduleFilterOperator;
  readonly value: string | number;
}

export interface ScheduleDefinition {
  readonly id: ScheduleId;
  readonly name: string;
  /** Which element category this schedules, e.g. "Door", "Room". */
  readonly category: string;
  readonly fields: readonly ScheduleField[];
  readonly filters: readonly ScheduleFilter[];
  /** Applied in order: the first sort is primary, the second breaks its ties. */
  readonly sorts: readonly ScheduleSort[];
  /**
   * Field key to group rows under, if any. A single key rather than a list:
   * nested grouping is a presentation feature with no consumer yet, and adding
   * it now would fix an ordering semantics nothing has asked for.
   */
  readonly groupBy?: string;
}

export interface CreateScheduleInput {
  readonly id: ScheduleId;
  readonly name: string;
  readonly category: string;
  readonly fields: readonly ScheduleField[];
  readonly filters?: readonly ScheduleFilter[];
  readonly sorts?: readonly ScheduleSort[];
  readonly groupBy?: string;
}

/**
 * Constructs a ScheduleDefinition.
 *
 * The checks are the ones that can be made against the definition alone. A
 * schedule with no fields is a blank table; a duplicate field key produces two
 * identical columns whose headings suggest they differ; a sort or a groupBy on
 * a key no column carries orders rows by something the reader cannot see, which
 * reads as an arbitrary order rather than as a missing column.
 *
 * Filters are deliberately *not* required to name a listed field: filtering on
 * a property the table does not display is ordinary practice - "every door on
 * level 2" is a level filter on a schedule with no level column.
 */
export function createSchedule(input: CreateScheduleInput): ScheduleDefinition {
  if (input.name.trim().length === 0) {
    throw new RangeError('a ScheduleDefinition must have a non-empty name');
  }
  if (input.category.trim().length === 0) {
    throw new RangeError('a ScheduleDefinition must name a category');
  }
  if (input.fields.length === 0) {
    throw new RangeError('a ScheduleDefinition must have at least one field');
  }

  const keys = new Set<string>();
  for (const field of input.fields) {
    if (keys.has(field.key)) {
      throw new RangeError(`duplicate schedule field key: ${field.key}`);
    }
    keys.add(field.key);
  }

  const sorts = input.sorts ?? [];
  for (const sort of sorts) {
    if (!keys.has(sort.key)) {
      throw new RangeError(`schedule sorts on ${sort.key}, which is not one of its fields`);
    }
  }
  if (input.groupBy !== undefined && !keys.has(input.groupBy)) {
    throw new RangeError(`schedule groups by ${input.groupBy}, which is not one of its fields`);
  }

  return {
    id: input.id,
    name: input.name,
    category: input.category,
    fields: input.fields,
    filters: input.filters ?? [],
    sorts,
    ...(input.groupBy === undefined ? {} : { groupBy: input.groupBy }),
  };
}

/**
 * Whether a change to `changedKeys` on an element of `category` can affect this
 * schedule's output.
 *
 * Used to decide whether a schedule needs re-evaluating, which is the only
 * caching this design permits: caching the *decision to recompute* is safe in a
 * way that caching rows is not. A key appearing in a filter counts even though
 * it has no column - a filtered-out element reappearing is a change to the
 * table.
 */
export function scheduleIsAffectedBy(
  schedule: ScheduleDefinition,
  category: string,
  changedKeys: readonly string[],
): boolean {
  if (category !== schedule.category) {
    return false;
  }
  const relevant = new Set<string>([
    ...schedule.fields.map((field) => field.key),
    ...schedule.filters.map((filter) => filter.key),
  ]);
  return changedKeys.some((key) => relevant.has(key));
}
