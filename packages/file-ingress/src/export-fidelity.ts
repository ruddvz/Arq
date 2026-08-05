/**
 * V3-175: an export says what it could not carry. V3-178: a round trip is
 * checked rather than assumed.
 *
 * `ImportReport` already tells a user what Arq did to a file it read. Nothing
 * told them what Arq does to a file it writes, and the asymmetry is the wrong
 * way round: an import that loses something is discovered by looking at the
 * result, while an export that loses something is discovered by the consultant
 * who opens it a week later.
 *
 * Every export to a foreign format loses something, because the formats do not
 * hold the same concepts. A DXF has no idea what a room is. An IFC has no idea
 * what an Arq wall type's derived invalidations are. That is fine and expected;
 * what is not fine is the file arriving as though it were complete. So an
 * export report names what was carried, what was flattened into something
 * simpler, and what could not go at all - in the model's terms, since "3
 * entities omitted" is a number and "the 3 rooms on Level 2 have no equivalent
 * in DXF and were not written" is a fact someone can act on.
 *
 * The round-trip check (V3-178) is what stops the report being a claim. Writing
 * a file and reading it back with Arq's own importer is a test the exporter
 * cannot pass by asserting: either the walls come back as walls with the same
 * lengths, or they do not. It only ever covers the *supported subset* - a
 * round trip through DXF will not return a room, and expecting it to would
 * make the check fail for the one reason that is not a defect.
 */

export type ExportCarriage =
  /** Written with everything Arq holds about it. */
  | 'full'
  /** Written, with detail the target format cannot express dropped. */
  | 'simplified'
  /** Written as a different concept - a room as a closed polyline, a wall as two lines. */
  | 'substituted'
  /** Not written at all. */
  | 'omitted';

export interface ExportCategoryOutcome {
  readonly category: string;
  readonly carriage: ExportCarriage;
  readonly count: number;
  /** What was lost, in the model's terms. Required for anything but `full`. */
  readonly detail?: string;
}

export interface ExportReport {
  readonly formatId: string;
  readonly exporterId: string;
  readonly exporterVersion: string;
  readonly projectRevision: number;
  readonly outcomes: readonly ExportCategoryOutcome[];
  readonly outputByteLength: number;
  readonly outputSha256: string;
}

export const EXPORT_REPORT_REJECTIONS = {
  lossWithoutDetail: 'ARQ_EXPORT_LOSS_WITHOUT_DETAIL',
  duplicateCategory: 'ARQ_EXPORT_DUPLICATE_CATEGORY',
} as const;

/**
 * Checks a report before it is shown.
 *
 * A `simplified`, `substituted` or `omitted` outcome with no detail is the
 * failure mode this exists to prevent, stated in the report itself: it tells
 * the user something was lost and refuses to say what, which is worse than
 * silence because it produces worry without a next step.
 */
export function validateExportReport(report: ExportReport): string | null {
  const seen = new Set<string>();
  for (const outcome of report.outcomes) {
    if (seen.has(outcome.category)) {
      return `${EXPORT_REPORT_REJECTIONS.duplicateCategory}: ${outcome.category} appears twice`;
    }
    seen.add(outcome.category);

    if (outcome.carriage !== 'full' && (outcome.detail ?? '').trim().length === 0) {
      return `${EXPORT_REPORT_REJECTIONS.lossWithoutDetail}: ${outcome.category} is ${outcome.carriage} with no explanation`;
    }
  }
  return null;
}

/** True when nothing was simplified, substituted or omitted. */
export function exportWasComplete(report: ExportReport): boolean {
  return report.outcomes.every((outcome) => outcome.carriage === 'full');
}

/**
 * The sentences a user should see before sending the file.
 *
 * Before, not after: an export dialog that lists what will not survive lets
 * someone pick a different format, and a report shown afterwards only tells
 * them what they have already sent.
 */
export function describeExportLosses(report: ExportReport): readonly string[] {
  return report.outcomes
    .filter((outcome) => outcome.carriage !== 'full')
    .map((outcome) => {
      const noun = outcome.count === 1 ? outcome.category : `${outcome.category} elements`;
      switch (outcome.carriage) {
        case 'omitted':
          return `${outcome.count} ${noun} were not written. ${outcome.detail ?? ''}`.trim();
        case 'substituted':
          return `${outcome.count} ${noun} were written as something else. ${outcome.detail ?? ''}`.trim();
        default:
          return `${outcome.count} ${noun} lost detail. ${outcome.detail ?? ''}`.trim();
      }
    });
}

/** One element as it stands on either side of a round trip. */
export interface RoundTripElement {
  readonly stableKey: string;
  readonly category: string;
  /** Only the properties the target format is expected to carry. */
  readonly properties: Readonly<Record<string, number | string>>;
}

export type RoundTripFindingKind = 'missing' | 'unexpected' | 'value-drift' | 'category-changed';

export interface RoundTripFinding {
  readonly kind: RoundTripFindingKind;
  readonly stableKey: string;
  readonly property?: string;
  readonly before?: number | string;
  readonly after?: number | string;
  readonly detail: string;
}

export interface RoundTripResult {
  readonly checkedCount: number;
  readonly findings: readonly RoundTripFinding[];
  readonly passed: boolean;
}

/**
 * Compares what went out with what came back.
 *
 * `toleranceByProperty` is required per numeric property rather than being one
 * global epsilon, because the tolerances are not the same kind of number: a
 * coordinate written to six decimal places in a text format and read back
 * differs in the last place, while an area recomputed from those coordinates
 * differs by rather more, and one tolerance covering both would either fail on
 * the first or pass anything on the second.
 *
 * Only categories in `supportedCategories` are checked. A round trip through
 * DXF will not return a room, and failing for that reason would make the check
 * fail for the one thing that is not a defect - and a check that always fails
 * gets turned off.
 */
export function compareRoundTrip(
  before: readonly RoundTripElement[],
  after: readonly RoundTripElement[],
  supportedCategories: ReadonlySet<string>,
  toleranceByProperty: Readonly<Record<string, number>>,
): RoundTripResult {
  const expected = before.filter((element) => supportedCategories.has(element.category));
  const returned = new Map(
    after
      .filter((element) => supportedCategories.has(element.category))
      .map((e) => [e.stableKey, e]),
  );

  const findings: RoundTripFinding[] = [];

  for (const element of expected) {
    const match = returned.get(element.stableKey);
    if (match === undefined) {
      findings.push({
        kind: 'missing',
        stableKey: element.stableKey,
        detail: `${element.category} ${element.stableKey} did not come back`,
      });
      continue;
    }
    returned.delete(element.stableKey);

    if (match.category !== element.category) {
      findings.push({
        kind: 'category-changed',
        stableKey: element.stableKey,
        before: element.category,
        after: match.category,
        detail: `came back as ${match.category}`,
      });
    }

    for (const [property, value] of Object.entries(element.properties)) {
      const returnedValue = match.properties[property];
      if (returnedValue === undefined) {
        findings.push({
          kind: 'missing',
          stableKey: element.stableKey,
          property,
          before: value,
          detail: `${property} did not come back`,
        });
        continue;
      }
      if (!valuesWithinTolerance(value, returnedValue, toleranceByProperty[property])) {
        findings.push({
          kind: 'value-drift',
          stableKey: element.stableKey,
          property,
          before: value,
          after: returnedValue,
          detail: `${property} changed beyond its tolerance`,
        });
      }
    }
  }

  for (const [stableKey, element] of returned) {
    findings.push({
      kind: 'unexpected',
      stableKey,
      detail: `${element.category} ${stableKey} came back but was never written`,
    });
  }

  findings.sort(
    (a, b) =>
      a.stableKey.localeCompare(b.stableKey) || (a.property ?? '').localeCompare(b.property ?? ''),
  );

  return { checkedCount: expected.length, findings, passed: findings.length === 0 };
}

/**
 * A numeric property with no declared tolerance is compared exactly.
 *
 * Not with a fallback epsilon: a property nobody has thought about the
 * precision of is one whose drift nobody has agreed to, and an exact comparison
 * fails loudly and gets the tolerance decided. A silent default would let a
 * real loss through under a number nobody chose.
 */
function valuesWithinTolerance(
  before: number | string,
  after: number | string,
  tolerance: number | undefined,
): boolean {
  if (typeof before === 'number' && typeof after === 'number') {
    return tolerance === undefined
      ? Object.is(before, after)
      : Math.abs(before - after) <= tolerance;
  }
  return before === after;
}
