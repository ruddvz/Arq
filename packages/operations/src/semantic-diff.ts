/**
 * V3-166 / AC3-090: show what a proposal would change, in the model's terms.
 *
 * A reviewer cannot approve an operation list. "update-property, payload
 * {elementId, key, value}" is a faithful description of what will run and tells
 * an architect nothing about what will happen to their building. What they need
 * is the difference between the project now and the project after: this wall
 * moves 200mm, that room's area drops, this door loses its host.
 *
 * Two rules shape the output, and both are about not overstating what is known.
 *
 * **Derived changes are labelled derived.** A room's area changing is a
 * consequence of a wall moving, not a second thing the AI decided to do. Listing
 * them together reads as a proposal that touched twice as much as it did, and a
 * reviewer who rejects the area change is really rejecting the wall move -
 * except nothing in the list says so. So each entry says whether it was
 * requested or followed.
 *
 * **A property with no before is not a change from zero.** An element gaining a
 * property it never had, an element that did not exist, a value the snapshot
 * never captured: all three are absent, and reporting them as "0 → 200" invents
 * a previous state. `before` is optional and its absence is meaningful.
 *
 * This diffs two snapshots rather than reading operations, because an operation
 * describes intent and a snapshot describes outcome, and the gap between them is
 * exactly what a reviewer is checking for.
 */

export interface ElementSnapshot {
  readonly elementId: string;
  readonly category: string;
  /** Display name for the review list. Falls back to the id where there is none. */
  readonly label?: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface ModelSnapshot {
  readonly revision: number;
  readonly elements: readonly ElementSnapshot[];
}

/** Whether a change is something the proposal asked for, or a consequence of one. */
export type ChangeOrigin = 'requested' | 'derived';

export interface PropertyChange {
  readonly key: string;
  /** Absent when the property did not exist before - not the same as a previous value of zero. */
  readonly before?: unknown;
  /** Absent when the property no longer exists. */
  readonly after?: unknown;
}

export type SemanticChange =
  | {
      readonly kind: 'added';
      readonly elementId: string;
      readonly category: string;
      readonly label: string;
      readonly origin: ChangeOrigin;
    }
  | {
      readonly kind: 'removed';
      readonly elementId: string;
      readonly category: string;
      readonly label: string;
      readonly origin: ChangeOrigin;
    }
  | {
      readonly kind: 'modified';
      readonly elementId: string;
      readonly category: string;
      readonly label: string;
      readonly origin: ChangeOrigin;
      readonly properties: readonly PropertyChange[];
    };

export interface SemanticDiff {
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly changes: readonly SemanticChange[];
  /** Counts for a summary line, so a surface need not recount. */
  readonly summary: {
    readonly added: number;
    readonly removed: number;
    readonly modified: number;
    readonly derived: number;
  };
}

export interface SemanticDiffOptions {
  /**
   * Element ids the proposal's operations name directly. Everything else that
   * moved is a consequence, and is labelled as one.
   */
  readonly requestedElementIds?: ReadonlySet<string>;
  /**
   * Properties to leave out of the comparison - a `modifiedAt`, a cache key, a
   * derived hash. Named by the caller rather than guessed, because a field that
   * looks like bookkeeping in one category is real data in another.
   */
  readonly ignoredProperties?: ReadonlySet<string>;
}

/**
 * Diffs two snapshots.
 *
 * Changes come back sorted by element id, so the same pair of snapshots always
 * produces the same list. A review surface that reordered between renders would
 * move a row out from under a reviewer's cursor as they worked down it.
 */
export function diffSnapshots(
  before: ModelSnapshot,
  after: ModelSnapshot,
  options: SemanticDiffOptions = {},
): SemanticDiff {
  const requested = options.requestedElementIds ?? new Set<string>();
  const ignored = options.ignoredProperties ?? new Set<string>();

  const beforeById = new Map(before.elements.map((element) => [element.elementId, element]));
  const afterById = new Map(after.elements.map((element) => [element.elementId, element]));

  const changes: SemanticChange[] = [];

  for (const [elementId, element] of afterById) {
    const previous = beforeById.get(elementId);
    if (previous === undefined) {
      changes.push({
        kind: 'added',
        elementId,
        category: element.category,
        label: labelOf(element),
        origin: requested.has(elementId) ? 'requested' : 'derived',
      });
      continue;
    }

    const properties = comparePropertyMaps(previous.properties, element.properties, ignored);
    if (properties.length > 0) {
      changes.push({
        kind: 'modified',
        elementId,
        category: element.category,
        label: labelOf(element),
        origin: requested.has(elementId) ? 'requested' : 'derived',
        properties,
      });
    }
  }

  for (const [elementId, element] of beforeById) {
    if (afterById.has(elementId)) {
      continue;
    }
    changes.push({
      kind: 'removed',
      elementId,
      category: element.category,
      label: labelOf(element),
      origin: requested.has(elementId) ? 'requested' : 'derived',
    });
  }

  changes.sort((a, b) => a.elementId.localeCompare(b.elementId));

  return {
    fromRevision: before.revision,
    toRevision: after.revision,
    changes,
    summary: {
      added: changes.filter((change) => change.kind === 'added').length,
      removed: changes.filter((change) => change.kind === 'removed').length,
      modified: changes.filter((change) => change.kind === 'modified').length,
      derived: changes.filter((change) => change.origin === 'derived').length,
    },
  };
}

function labelOf(element: ElementSnapshot): string {
  return element.label ?? element.elementId;
}

function comparePropertyMaps(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
  ignored: ReadonlySet<string>,
): readonly PropertyChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: PropertyChange[] = [];

  for (const key of [...keys].sort()) {
    if (ignored.has(key)) {
      continue;
    }
    const hadBefore = Object.prototype.hasOwnProperty.call(before, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
    const previous = before[key];
    const next = after[key];

    if (hadBefore && hasAfter && valuesEqual(previous, next)) {
      continue;
    }
    changes.push({
      // Omitted rather than set to undefined: an absent property and a property
      // whose value is undefined are different facts, and a reviewer reading
      // "undefined -> 200" is being told about a previous state that never was.
      ...(hadBefore ? { before: previous } : {}),
      ...(hasAfter ? { after: next } : {}),
      key,
    });
  }

  return changes;
}

/**
 * Structural equality over the value shapes a snapshot holds.
 *
 * Deliberately not a deep-equality library: the values here are property
 * values - numbers, strings, `Length` records, id arrays - and a general
 * deep-equal would also have opinions about Dates, Maps and cycles that this
 * has no need for and could not test.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => valuesEqual(entry, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
      return false;
    }
    return keys.every(
      (key) => Object.prototype.hasOwnProperty.call(b, key) && valuesEqual(a[key], b[key]),
    );
  }
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The changes a reviewer is being asked to approve, without the consequences.
 *
 * The consequences still have to be shown - a reviewer who cannot see that a
 * room's area moved has been shown a partial truth - but they belong in a
 * separate section, because approving them is not a separate decision.
 */
export function requestedChanges(diff: SemanticDiff): readonly SemanticChange[] {
  return diff.changes.filter((change) => change.origin === 'requested');
}

export function derivedChanges(diff: SemanticDiff): readonly SemanticChange[] {
  return diff.changes.filter((change) => change.origin === 'derived');
}

/** True when the two snapshots describe the same model. Used to report a proposal that would do nothing. */
export function diffIsEmpty(diff: SemanticDiff): boolean {
  return diff.changes.length === 0;
}
