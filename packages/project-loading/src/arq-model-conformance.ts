/**
 * Why a second pass over `model.json` exists at all.
 *
 * `parseNativeProjectModel` (native-project-model.ts) is the product reader, and
 * it is deliberately fail-fast: the first thing it cannot trust ends the parse,
 * because a half-read project must never reach a renderer. That is right for
 * opening a file and useless for judging one. A file that diverges from the
 * contract in ten places reports one reason, the author fixes it, and the next
 * run reports the second - ten round trips to learn what one pass could have
 * said.
 *
 * This module answers the other question: *given a `model.json`, what would this
 * build have to be handed instead before it hydrates?* It enumerates every
 * divergence in one pass, grouped by section, counting how many entries each one
 * affects, and never stops early.
 *
 * It is a diagnostic, not a second reader, and two rules keep it that way:
 *
 * 1. `parseNativeProjectModel` remains the authority. `checkArqModelConformance`
 *    always runs it and reports its verdict verbatim as `readerVerdict`. When the
 *    two ever disagree - findings but the reader parsed, or none but it rejected -
 *    that disagreement is itself reported (`consistentWithReader: false`) rather
 *    than papered over, because the mirror having drifted is exactly the failure
 *    this module would otherwise hide.
 * 2. It never repairs anything. Knowing a file declares `units: "mm"` where the
 *    contract wants `metric` is a finding; quietly translating it would turn a
 *    diagnostic into an import path nobody reviewed.
 *
 * The contract mirrored here is native-project-model.ts's, and its test asserts
 * the mirror against the real reader on both a conforming and a non-conforming
 * file, so drift fails a test rather than silently producing wrong advice.
 */
import { parseNativeProjectModel, type NativeProjectView } from './native-project-model';

/**
 * One way a file diverges from the reader contract, at the granularity a person
 * fixes it: a field, not an element. Sixty-eight walls with the same unrecognised
 * join intent are one finding affecting sixty-eight entries, not sixty-eight
 * findings - the writer that produced them has one bug.
 */
export interface ArqModelConformanceFinding {
  /** The `model.json` section, e.g. `walls`, or `model` for the document itself. */
  readonly section: string;
  /** The field within that section, in the file's own vocabulary. */
  readonly field: string;
  /** What the file actually carries, as a short readable value or value set. */
  readonly found: string;
  /** What native-project-model.ts requires instead. */
  readonly expected: string;
  /**
   * How many entries in the section carry this divergence. `1` for a
   * whole-document finding; a section-wide finding counts the entries, so a
   * report can say which divergence is the expensive one to fix.
   */
  readonly affectedEntries: number;
  /**
   * `blocking` divergences make `parseNativeProjectModel` reject. `lossy` ones
   * parse but lose meaning the file carries - content this build reads past
   * rather than refuses. Kept apart so a report never tells someone a file is
   * unopenable when it opens and merely under-represents.
   */
  readonly severity: 'blocking' | 'lossy';
}

export interface ArqModelConformanceReport {
  /** The real reader's verdict - the authority, not this module's opinion. */
  readonly readerVerdict: 'parsed' | 'rejected';
  /** The reader's own rejection reason, verbatim; null when it parsed. */
  readonly readerReason: string | null;
  /** True exactly when the product reader hydrates this model as it stands. */
  readonly hydrates: boolean;
  readonly findings: readonly ArqModelConformanceFinding[];
  /**
   * How many elements of each kind the file declares, counted from the file
   * whether or not it hydrates. The point of the report is to say what is in
   * there that a reader is currently refusing.
   */
  readonly declaredCounts: Readonly<Record<string, number>>;
  /**
   * False when this module's findings and the reader's verdict contradict each
   * other, which means the mirror has drifted from the contract it mirrors.
   */
  readonly consistentWithReader: boolean;
}

/** Mirrors native-project-model.ts's own constants. Kept literal here so a change there fails this module's test rather than silently widening it. */
const KNOWN_MODEL_SCHEMA_BASES: readonly string[] = ['arq-bim-core-reference-v0'];
const WALL_ALIGNMENTS: readonly string[] = ['centre', 'interior', 'exterior'];
const WALL_JOIN_INTENTS: readonly string[] = ['auto', 'butt', 'mitre', 'disallow'];
const ROOM_STATUSES: readonly string[] = [
  'valid',
  'not-enclosed',
  'overlapping',
  'too-small',
  'invalid-polygon',
  'stale',
];
const OPENING_KINDS: readonly string[] = ['door', 'window', 'void'];
const SIDES: readonly string[] = ['left', 'right'];
const LENGTH_UNITS: readonly string[] = ['mm', 'cm', 'm', 'in', 'ft'];
const UNITS_PREFERENCES: readonly string[] = ['metric', 'imperial'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** A `{ value, unit }` length the reader would accept. */
function isLength(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    typeof value.unit === 'string' &&
    LENGTH_UNITS.includes(value.unit)
  );
}

/**
 * Renders the distinct values a field actually takes, so a finding names the
 * vocabulary rather than only the count. Truncated because a field with hundreds
 * of distinct values is not a vocabulary mismatch and does not need listing.
 */
function distinct(values: readonly unknown[]): string {
  const seen = new Set<string>();
  for (const value of values) {
    seen.add(value === undefined ? '(absent)' : JSON.stringify(value));
    if (seen.size > 4) break;
  }
  const shown = [...seen].slice(0, 4);
  return seen.size > 4 ? `${shown.join(', ')}, …` : shown.join(', ');
}

/**
 * Records a finding for entries failing `accepts`. Returns nothing when every
 * entry passes, so the caller reads as a list of contract clauses rather than a
 * chain of conditionals.
 */
function checkField(
  findings: ArqModelConformanceFinding[],
  section: string,
  entries: readonly Record<string, unknown>[],
  field: string,
  accepts: (value: unknown, entry: Record<string, unknown>) => boolean,
  expected: string,
  severity: 'blocking' | 'lossy' = 'blocking',
): void {
  const failing = entries.filter((entry) => !accepts(entry[field], entry));
  if (failing.length === 0) return;
  findings.push({
    section,
    field,
    found: distinct(failing.map((entry) => entry[field])),
    expected,
    affectedEntries: failing.length,
    severity,
  });
}

/**
 * Enumerates every way `raw` diverges from what `parseNativeProjectModel` will
 * accept, and reports that reader's own verdict alongside.
 *
 * `views` is passed through to the reader unchanged; it does not affect
 * conformance (views.json is optional content the reader never rejects on) and
 * exists so a caller can hand over the same arguments it would use to open the
 * file for real.
 */
export function checkArqModelConformance(
  raw: unknown,
  views: readonly NativeProjectView[] = [],
): ArqModelConformanceReport {
  const readerResult = parseNativeProjectModel(raw, views);
  const findings: ArqModelConformanceFinding[] = [];

  if (!isRecord(raw)) {
    return {
      readerVerdict: readerResult.status,
      readerReason: readerResult.status === 'rejected' ? readerResult.reason : null,
      hydrates: readerResult.status === 'parsed',
      findings: [
        {
          section: 'model',
          field: '(document)',
          found: typeof raw,
          expected: 'a JSON object',
          affectedEntries: 1,
          severity: 'blocking',
        },
      ],
      declaredCounts: {},
      consistentWithReader: readerResult.status === 'rejected',
    };
  }

  const document = [raw];

  // The schema tag, first, for the same reason the reader checks it first: every
  // finding below is only meaningful if the field meanings are the known ones.
  checkField(
    findings,
    'model',
    document,
    'modelSchema',
    (value) =>
      typeof value === 'string' &&
      value.length > 0 &&
      KNOWN_MODEL_SCHEMA_BASES.includes(value.split('+')[0]!),
    `a model schema whose base is one of: ${KNOWN_MODEL_SCHEMA_BASES.join(', ')}`,
  );

  /*
   * The project record. A file may carry these fields flat at the top level - it
   * is a natural shape to write by hand - and the reader will not find them
   * there, so the finding names where it looked rather than only that they are
   * missing.
   */
  const project = isRecord(raw.project) ? raw.project : null;
  if (project === null) {
    const flat = ['id', 'name', 'revision', 'units'].filter((key) => key in raw);
    findings.push({
      section: 'model',
      field: 'project',
      found:
        flat.length > 0
          ? `absent; ${flat.join(', ')} are declared at the top level instead`
          : 'absent',
      expected: 'a nested project record carrying id, name, revision and units',
      affectedEntries: 1,
      severity: 'blocking',
    });
  } else {
    const projectRecord = [project];
    checkField(
      findings,
      'project',
      projectRecord,
      'id',
      (value) => typeof value === 'string' && value.length > 0,
      'a non-empty id',
    );
    checkField(
      findings,
      'project',
      projectRecord,
      'name',
      (value) => typeof value === 'string' && value.length > 0,
      'a non-empty name',
    );
    checkField(
      findings,
      'project',
      projectRecord,
      'revision',
      (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0,
      'a whole revision number of zero or more',
    );
    checkField(
      findings,
      'project',
      projectRecord,
      'units',
      (value) => typeof value === 'string' && UNITS_PREFERENCES.includes(value),
      `a units preference, one of: ${UNITS_PREFERENCES.join(', ')}`,
    );
  }

  const levels = records(raw.levels);
  const wallTypes = records(raw.wallTypes);
  const walls = records(raw.walls);
  const rooms = records(raw.rooms);
  const openings = records(raw.openings);
  const doors = records(raw.doors);
  const windows = records(raw.windows);

  for (const [section, value] of [
    ['levels', raw.levels],
    ['wallTypes', raw.wallTypes],
    ['walls', raw.walls],
  ] as const) {
    if (!Array.isArray(value)) {
      findings.push({
        section,
        field: '(section)',
        found: value === undefined ? '(absent)' : typeof value,
        expected: 'a list - this section is required',
        affectedEntries: 1,
        severity: 'blocking',
      });
    }
  }

  if (levels.length === 0 && Array.isArray(raw.levels)) {
    findings.push({
      section: 'levels',
      field: '(section)',
      found: 'an empty list',
      expected: 'at least one level, since geometry is placed on levels',
      affectedEntries: 1,
      severity: 'blocking',
    });
  }

  checkField(
    findings,
    'levels',
    levels,
    'elevation',
    (value) => typeof value === 'number' && Number.isFinite(value),
    'a finite elevation',
  );

  /*
   * Wall types carry the two lengths every downstream surface needs - a plan
   * offset and a 3D extrusion - so a bare number is not merely a different
   * spelling of the same thing: it is a length with no unit, which neither
   * renderer may assume.
   */
  checkField(findings, 'wallTypes', wallTypes, 'thickness', isLength, 'a { value, unit } length');
  checkField(
    findings,
    'wallTypes',
    wallTypes,
    'defaultHeight',
    isLength,
    'a { value, unit } length',
  );
  checkField(
    findings,
    'wallTypes',
    wallTypes,
    'function',
    (value) => value === 'exterior' || value === 'interior',
    'either exterior or interior',
  );

  checkField(
    findings,
    'walls',
    walls,
    'alignment',
    (value) => typeof value === 'string' && WALL_ALIGNMENTS.includes(value),
    `one of: ${WALL_ALIGNMENTS.join(', ')}`,
  );
  for (const field of ['joinStart', 'joinEnd'] as const) {
    checkField(
      findings,
      'walls',
      walls,
      field,
      (value) => typeof value === 'string' && WALL_JOIN_INTENTS.includes(value),
      `a join intent, one of: ${WALL_JOIN_INTENTS.join(', ')}`,
    );
  }
  /*
   * A per-wall height is `heightOverride`, a length, and the reader ignores any
   * other spelling of it. That is lossy rather than blocking: the wall still
   * draws, at its type's default height, which is the wrong height - silently.
   */
  checkField(
    findings,
    'walls',
    walls,
    'height',
    (value) => value === undefined,
    'heightOverride as a { value, unit } length; a bare height is not read',
    'lossy',
  );

  checkField(
    findings,
    'openings',
    openings,
    'kind',
    (value) => typeof value === 'string' && OPENING_KINDS.includes(value),
    `one of: ${OPENING_KINDS.join(', ')}`,
  );
  for (const field of ['offsetFromWallStart', 'width', 'sillHeight', 'height'] as const) {
    checkField(findings, 'openings', openings, field, isLength, 'a { value, unit } length');
  }

  for (const field of ['side', 'hand'] as const) {
    checkField(
      findings,
      'doors',
      doors,
      field,
      (value) => typeof value === 'string' && SIDES.includes(value),
      `one of: ${SIDES.join(', ')}`,
    );
  }
  checkField(
    findings,
    'doors',
    doors,
    'swingAngle',
    (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 180,
    'a swing angle from 0 to 180 degrees',
  );

  checkField(
    findings,
    'windows',
    windows,
    'side',
    (value) => typeof value === 'string' && SIDES.includes(value),
    `one of: ${SIDES.join(', ')}`,
  );

  checkField(
    findings,
    'rooms',
    rooms,
    'status',
    (value) => typeof value === 'string' && ROOM_STATUSES.includes(value),
    `one of: ${ROOM_STATUSES.join(', ')}`,
  );
  checkField(
    findings,
    'rooms',
    rooms,
    'calculatedBoundary',
    (value) => Array.isArray(value),
    'a list of points',
  );

  const declaredCounts: Record<string, number> = {
    levels: levels.length,
    wallTypes: wallTypes.length,
    walls: walls.length,
    rooms: rooms.length,
    openings: openings.length,
    doors: doors.length,
    windows: windows.length,
  };

  const blocking = findings.filter((finding) => finding.severity === 'blocking');
  const hydrates = readerResult.status === 'parsed';
  /*
   * The mirror is consistent with the reader when it found a blocking reason
   * exactly when the reader rejected. Either direction of disagreement means the
   * contract moved and this module did not follow it.
   */
  const consistentWithReader = hydrates ? blocking.length === 0 : blocking.length > 0;

  return {
    readerVerdict: readerResult.status,
    readerReason: readerResult.status === 'rejected' ? readerResult.reason : null,
    hydrates,
    findings,
    declaredCounts,
    consistentWithReader,
  };
}

/** Renders a report as the plain-text block the capability check prints and CI logs. */
export function formatArqModelConformanceReport(report: ArqModelConformanceReport): string {
  const lines: string[] = [];
  lines.push(`Reader verdict: ${report.readerVerdict}`);
  if (report.readerReason !== null) lines.push(`Reader reason: ${report.readerReason}`);
  lines.push(`Hydrates in this build: ${report.hydrates ? 'yes' : 'no'}`);
  lines.push(
    `Declared elements: ${Object.entries(report.declaredCounts)
      .map(([section, count]) => `${section} ${count}`)
      .join(', ')}`,
  );
  if (!report.consistentWithReader) {
    lines.push(
      'WARNING: conformance findings disagree with the reader verdict - this checker has drifted from native-project-model.ts.',
    );
  }
  if (report.findings.length === 0) {
    lines.push('No contract divergences found.');
    return lines.join('\n');
  }
  lines.push(`Divergences: ${report.findings.length}`);
  for (const finding of report.findings) {
    lines.push(
      `  [${finding.severity}] ${finding.section}.${finding.field} (${finding.affectedEntries} entr${finding.affectedEntries === 1 ? 'y' : 'ies'})`,
    );
    lines.push(`      found:    ${finding.found}`);
    lines.push(`      expected: ${finding.expected}`);
  }
  return lines.join('\n');
}
