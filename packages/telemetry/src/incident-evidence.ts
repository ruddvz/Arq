import type { DiagnosticReceipt } from './diagnostic-receipt';

/**
 * V3-188: capture the evidence before repairing anything.
 *
 * The thing needed to diagnose a corrupt project file is the corrupt project
 * file. Recovery repairs it, which is the correct thing to do for the user and
 * destroys the only copy of the only evidence - and it does so at exactly the
 * moment nobody is thinking about diagnosis, because someone's work is at risk
 * and getting it back is all that matters.
 *
 * So the order is fixed here rather than left to whoever writes the recovery
 * path: preserve, then recover. `preserveIncidentEvidence` returns a record
 * that a recovery step requires as an argument, so a recovery that skipped
 * preservation is not a recovery that behaves differently - it is one that does
 * not compile.
 *
 * A preserved artifact is immutable. That is not tidiness: the failure mode is
 * a well-meaning cleanup pass compacting the preserved copy, or a second
 * incident overwriting the first, and either leaves an artifact that looks like
 * evidence and is not. Preservation records are keyed by incident and are never
 * updated.
 *
 * Nothing here transmits anything. Preserving is local, and sharing is a
 * separate, opt-in decision made through `buildArqfsSupportBundle` with its
 * own preview - a user whose file failed to open has not thereby agreed to send
 * it anywhere.
 */

export type IncidentKind =
  | 'open-failed'
  | 'integrity-failed'
  | 'interrupted-write'
  | 'migration-failed'
  | 'publication-refused'
  | 'recovery-rejected';

/** A reference to bytes held elsewhere. Never the bytes: this module must not become a place project content lives. */
export interface PreservedArtifactRef {
  readonly artifactId: string;
  readonly role: 'source-file' | 'working-copy' | 'journal' | 'sidecar';
  readonly byteLength: number;
  readonly sha256: string;
}

export interface IncidentEvidence {
  readonly incidentId: string;
  readonly kind: IncidentKind;
  readonly detectedAtUnixMs: number;
  /** What was preserved, by reference. Empty when nothing could be - which is itself worth recording. */
  readonly artifacts: readonly PreservedArtifactRef[];
  /** The receipts around the incident, copied at capture time rather than referenced. */
  readonly receipts: readonly DiagnosticReceipt[];
  /** Whether every artifact the incident called for was actually preserved. */
  readonly complete: boolean;
  /** Named so a partial capture is diagnosable rather than merely incomplete. */
  readonly missingRoles: readonly PreservedArtifactRef['role'][];
}

/** What each kind of incident needs preserved for anyone to diagnose it later. */
export const REQUIRED_ARTIFACTS: Readonly<
  Record<IncidentKind, readonly PreservedArtifactRef['role'][]>
> = {
  'open-failed': ['source-file'],
  'integrity-failed': ['source-file'],
  // The write is the thing that failed, so the sidecars are the evidence: a
  // preserved main file without its WAL says nothing about what interrupted.
  'interrupted-write': ['working-copy', 'sidecar'],
  'migration-failed': ['source-file', 'working-copy'],
  'publication-refused': ['source-file', 'working-copy'],
  'recovery-rejected': ['working-copy', 'journal'],
};

export interface PreserveIncidentInput {
  readonly incidentId: string;
  readonly kind: IncidentKind;
  readonly detectedAtUnixMs: number;
  readonly artifacts: readonly PreservedArtifactRef[];
  readonly receipts: readonly DiagnosticReceipt[];
}

/**
 * Records what was preserved for an incident.
 *
 * An incomplete capture is recorded rather than refused. Refusing would mean a
 * failure to preserve one artifact throws away the ones that were preserved,
 * and half the evidence is worth considerably more than none - as long as the
 * record says which half, which `missingRoles` does.
 */
export function preserveIncidentEvidence(input: PreserveIncidentInput): IncidentEvidence {
  const required = REQUIRED_ARTIFACTS[input.kind];
  const present = new Set(input.artifacts.map((artifact) => artifact.role));
  const missingRoles = required.filter((role) => !present.has(role));

  return {
    incidentId: input.incidentId,
    kind: input.kind,
    detectedAtUnixMs: input.detectedAtUnixMs,
    // Copied rather than aliased: the caller's arrays keep changing, and
    // evidence that changes after capture is not evidence.
    artifacts: [...input.artifacts],
    receipts: [...input.receipts],
    complete: missingRoles.length === 0,
    missingRoles,
  };
}

export const INCIDENT_STORE_REFUSALS = {
  alreadyRecorded: 'ARQ_INCIDENT_ALREADY_RECORDED',
} as const;

/**
 * An append-only store of incident evidence.
 *
 * `record` refuses an incident id it already holds rather than replacing it.
 * The failure this prevents is a second incident, or a retry of the first,
 * overwriting the capture that actually mattered - which leaves something that
 * looks like evidence and is not.
 */
export function createIncidentEvidenceStore() {
  const byId = new Map<string, IncidentEvidence>();

  function record(evidence: IncidentEvidence): {
    readonly stored: boolean;
    readonly reason?: string;
  } {
    if (byId.has(evidence.incidentId)) {
      return { stored: false, reason: INCIDENT_STORE_REFUSALS.alreadyRecorded };
    }
    byId.set(evidence.incidentId, evidence);
    return { stored: true };
  }

  function get(incidentId: string): IncidentEvidence | undefined {
    return byId.get(incidentId);
  }

  /** Oldest first, so a reader follows a sequence of incidents in the order they happened. */
  function all(): readonly IncidentEvidence[] {
    return [...byId.values()].sort((a, b) => a.detectedAtUnixMs - b.detectedAtUnixMs);
  }

  return { record, get, all, count: () => byId.size };
}

export type IncidentEvidenceStore = ReturnType<typeof createIncidentEvidenceStore>;

/**
 * A token proving evidence was captured before recovery ran.
 *
 * A recovery step takes one of these, so preservation is not a discipline
 * anyone has to remember - it is a parameter. The token carries the incident id
 * rather than being a bare boolean so a later reader can find the evidence the
 * recovery was allowed to proceed on.
 */
export interface EvidenceCaptured {
  readonly incidentId: string;
  readonly complete: boolean;
}

/**
 * Issues the token, and only for evidence that is actually in the store.
 *
 * Returning null for an unstored incident is what stops the token being
 * constructible from nothing: a caller cannot mint permission by asserting it
 * preserved something.
 */
export function evidenceCapturedFor(
  store: IncidentEvidenceStore,
  incidentId: string,
): EvidenceCaptured | null {
  const evidence = store.get(incidentId);
  if (evidence === undefined) {
    return null;
  }
  // An incomplete capture still authorises recovery. The user's work matters
  // more than a perfect record, and the token carries `complete: false` so the
  // gap travels with the permission rather than being forgotten.
  return { incidentId, complete: evidence.complete };
}

/**
 * What a user should be told before recovery runs.
 *
 * Phrased so a partial capture is stated rather than hidden. A support
 * conversation that assumes a full capture and finds a gap wastes the one
 * chance to ask the user something while they still remember it.
 */
export function describeIncidentCapture(evidence: IncidentEvidence): string {
  if (evidence.complete) {
    return `A copy of the affected files was kept for diagnosis. Nothing was sent anywhere.`;
  }
  const missing = evidence.missingRoles.join(', ');
  return `A partial copy of the affected files was kept for diagnosis: ${missing} could not be preserved. Nothing was sent anywhere.`;
}
