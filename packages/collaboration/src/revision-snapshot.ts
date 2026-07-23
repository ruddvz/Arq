/**
 * ARQ-165: collaboration: implement revision snapshots.
 *
 * A RevisionSnapshot is a named, user-facing checkpoint ("Revision A -
 * submitted for permit") - the blueprint lists "revision comparison"
 * consistently alongside comments and issues (Release 2 scope, the
 * "Review" purpose list, section 82's collaboration sequence), distinct
 * from @arq/local-storage's snapshot.ts, which is a periodic *technical*
 * crash-recovery mechanism keyed by an internal revision number, not a
 * user-labeled checkpoint.
 *
 * `stateReference` is deliberately an opaque string, not a concrete type
 * imported from @arq/project-format or @arq/local-storage (a checksum, a
 * journal sequence number, whatever the caller's own persistence layer
 * uses to identify "this exact project state") - this package stays
 * agnostic to what that reference means, matching this backlog's
 * layering rule against coupling project semantics to this package's own
 * classes. This issue implements the snapshot *record* only; actually
 * diffing two revisions ("revision comparison" itself) is separate,
 * later work this issue's own non-goal against expanding scope rules out.
 *
 * A snapshot's `stateReference` and `createdAtMs` are immutable once
 * created (an audit trail is only meaningful if what a revision actually
 * points to cannot silently change); only `label`/`description` can be
 * edited later (see revision-snapshots-store.ts's renameRevisionSnapshot),
 * e.g. to fix a typo.
 */

export interface RevisionSnapshot {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly authorParticipantId: string;
  readonly createdAtMs: number;
  readonly stateReference: string;
}

export interface CreateRevisionSnapshotInput {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly authorParticipantId: string;
  readonly createdAtMs: number;
  readonly stateReference: string;
}

/** Constructs a new RevisionSnapshot; rejects an empty (or whitespace-only) label or state reference - a snapshot with no label is unusable in a revision list, and one with no state reference points at nothing. */
export function createRevisionSnapshot(input: CreateRevisionSnapshotInput): RevisionSnapshot {
  const trimmedLabel = input.label.trim();
  if (trimmedLabel.length === 0) {
    throw new RangeError('revision snapshot label must not be empty');
  }
  const trimmedStateReference = input.stateReference.trim();
  if (trimmedStateReference.length === 0) {
    throw new RangeError('revision snapshot stateReference must not be empty');
  }
  return {
    id: input.id,
    label: trimmedLabel,
    description: input.description?.trim() ?? '',
    authorParticipantId: input.authorParticipantId,
    createdAtMs: input.createdAtMs,
    stateReference: trimmedStateReference,
  };
}
