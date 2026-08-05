import type { ImportIssue } from './types';

/**
 * V3-177: an entity the importer does not understand is quarantined, not dropped.
 *
 * Every format has more in it than any importer reads. A DXF carries splines,
 * proxy entities, custom objects written by an application nobody here has;
 * an IFC carries entity types from schema extensions. The question is not
 * whether unsupported things arrive - they always do - but what happens to
 * them, and the default answer is the damaging one: skip it, count it, move on.
 *
 * The damage is that the count is the only trace. A user is told "37 entities
 * were not imported" and has no way to learn what they were, whether they
 * mattered, or where they were on the drawing. If the file was the only copy,
 * they are gone. And the count itself invites the wrong conclusion: 37 skipped
 * splines in a hatch pattern and 37 skipped structural members read identically.
 *
 * So an unsupported entity is kept. Its raw payload is preserved verbatim
 * alongside its source id, its type, and where it sat, and the report groups
 * them by type so it says what was quarantined rather than how much. Two
 * things follow that would not otherwise be possible: a later importer version
 * can convert them without the user re-importing, and a user can be shown
 * where the gaps are on the drawing.
 */

export type QuarantineReason =
  /** The importer has no mapping for this entity type at all. */
  | 'unsupported-type'
  /** The type is supported but this instance used a variant that is not. */
  | 'unsupported-variant'
  /** The entity referenced something that was itself quarantined or missing. */
  | 'unresolved-reference'
  /** The entity parsed but its values are not usable - a zero-length line, a NaN coordinate. */
  | 'degenerate-geometry'
  /** Reading it would exceed a policy limit. */
  | 'policy-limit';

export interface QuarantinedEntity {
  readonly sourceObjectId: string;
  /** The source format's own type name, e.g. "SPLINE", "IfcTendonAnchor". */
  readonly sourceType: string;
  readonly reason: QuarantineReason;
  /** Enough detail to act on, in the user's terms rather than the parser's. */
  readonly detail: string;
  /**
   * The entity's payload, verbatim. Kept so a later importer version can
   * convert it without the user re-importing, and so nothing is lost when the
   * imported file was the only copy.
   */
  readonly rawPayload: string;
  /** Where it sat, when the source said. Lets a surface show the user the gaps. */
  readonly sourceLayer?: string;
  readonly approximateExtent?: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  };
}

export interface QuarantineGroup {
  readonly sourceType: string;
  readonly reason: QuarantineReason;
  readonly count: number;
  /** A few examples, so a report can show one without holding every payload in the UI. */
  readonly sampleSourceObjectIds: readonly string[];
  readonly layers: readonly string[];
}

/** Enough examples to be recognisable, few enough not to become the report. */
export const QUARANTINE_SAMPLE_LIMIT = 5;

/**
 * Groups quarantined entities for a report.
 *
 * By type *and* reason, not by type alone: "40 SPLINE entities, 37 unsupported
 * and 3 degenerate" is two different problems with two different answers, and
 * collapsing them hides the smaller one behind the larger.
 *
 * Sorted by count descending, then by type, so the same import always produces
 * the same report and the largest group leads.
 */
export function groupQuarantined(
  entities: readonly QuarantinedEntity[],
): readonly QuarantineGroup[] {
  // Keyed on the first entity of each group as well as its members, so the
  // group's type and reason come from a value that is known to exist rather
  // than from an index into a list the compiler cannot prove is non-empty.
  const groups = new Map<
    string,
    { readonly first: QuarantinedEntity; members: QuarantinedEntity[] }
  >();

  for (const entity of entities) {
    const key = `${entity.sourceType}::${entity.reason}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { first: entity, members: [entity] });
    } else {
      existing.members.push(entity);
    }
  }

  return [...groups.values()]
    .map(({ first, members }) => ({
      sourceType: first.sourceType,
      reason: first.reason,
      count: members.length,
      sampleSourceObjectIds: members
        .slice(0, QUARANTINE_SAMPLE_LIMIT)
        .map((entity) => entity.sourceObjectId),
      layers: [...new Set(members.map((entity) => entity.sourceLayer).filter(isDefined))].sort(),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.sourceType.localeCompare(b.sourceType) ||
        a.reason.localeCompare(b.reason),
    );
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Import issues describing what was quarantined.
 *
 * Severity is `warning`, never `error`: the import succeeded, and something in
 * it needs attention. Calling it an error would make a drawing that imported
 * correctly look failed, and users who see errors on every successful import
 * stop reading them, which is how the one that mattered gets missed.
 */
export function quarantineIssues(groups: readonly QuarantineGroup[]): readonly ImportIssue[] {
  return groups.map((group) => ({
    severity: 'warning' as const,
    code: `ARQ_IMPORT_QUARANTINED_${group.reason.toUpperCase().replace(/-/gu, '_')}`,
    message: describeGroup(group),
  }));
}

function describeGroup(group: QuarantineGroup): string {
  const noun = group.count === 1 ? 'entity' : 'entities';
  const where = group.layers.length > 0 ? ` on ${group.layers.join(', ')}` : '';
  return `${group.count} ${group.sourceType} ${noun}${where}: ${reasonPhrase(group.reason)}. Kept in the project and not converted.`;
}

function reasonPhrase(reason: QuarantineReason): string {
  switch (reason) {
    case 'unsupported-type':
      return 'Arq does not read this entity type yet';
    case 'unsupported-variant':
      return 'Arq reads this entity type but not this variant';
    case 'unresolved-reference':
      return 'what it refers to was not imported';
    case 'degenerate-geometry':
      return 'its geometry cannot be used';
    case 'policy-limit':
      return 'reading it would exceed an import limit';
  }
}

/**
 * Total bytes of preserved payload.
 *
 * Reported because keeping everything has a cost, and a project that grew by
 * 40MB of quarantined splines should say so rather than surprising someone
 * later. Knowing the number is also what makes a future decision to cap it an
 * informed one.
 */
export function quarantinePayloadBytes(entities: readonly QuarantinedEntity[]): number {
  return entities.reduce((total, entity) => total + entity.rawPayload.length, 0);
}

/**
 * Whether an import preserved everything it did not convert.
 *
 * The check that makes the promise checkable: every source object that was not
 * mapped to a staged element must appear in quarantine. An object that is in
 * neither was dropped, which is the thing this module exists to prevent, and
 * without this it would be invisible.
 */
export function unaccountedSourceObjects(
  allSourceObjectIds: readonly string[],
  mappedSourceObjectIds: readonly string[],
  quarantined: readonly QuarantinedEntity[],
): readonly string[] {
  const accounted = new Set([
    ...mappedSourceObjectIds,
    ...quarantined.map((entity) => entity.sourceObjectId),
  ]);
  return allSourceObjectIds.filter((id) => !accounted.has(id));
}
