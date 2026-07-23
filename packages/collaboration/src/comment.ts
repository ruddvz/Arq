/**
 * ARQ-163: collaboration: implement comments.
 *
 * Plain data shape for one comment (docs/commands/specs/CMD-095's own
 * "target and body" inputs, plus threading via parentCommentId). No
 * dependency on @arq/bim-core: `targetElementId` is a plain string, not a
 * branded ElementId - matching every other cross-boundary module in this
 * backlog (plan-scene.ts, dimension-reference.ts, ...) that stays generic
 * rather than coupling project semantics to this package's own classes.
 *
 * createComment throws on genuinely invalid direct construction input (an
 * empty body) - this is a local constructor a caller controls, not an
 * untrusted-input parser boundary like parsePresenceState or parseDxf, so
 * it follows @arq/bim-core's createLevel/createLinearDimension precedent
 * of throwing rather than the "never throws" contract those parsers use.
 */

export interface Comment {
  readonly id: string;
  /** null means a general/project-level comment, not attached to any specific element. */
  readonly targetElementId: string | null;
  readonly authorParticipantId: string;
  readonly authorInitials: string;
  readonly body: string;
  readonly createdAtMs: number;
  readonly resolved: boolean;
  /** null for a top-level comment; a reply's parent comment id otherwise. */
  readonly parentCommentId: string | null;
}

export interface CreateCommentInput {
  readonly id: string;
  readonly targetElementId: string | null;
  readonly authorParticipantId: string;
  readonly authorInitials: string;
  readonly body: string;
  readonly createdAtMs: number;
  readonly parentCommentId?: string | null;
}

/** Constructs a new, unresolved Comment; rejects an empty (or whitespace-only) body. */
export function createComment(input: CreateCommentInput): Comment {
  const trimmedBody = input.body.trim();
  if (trimmedBody.length === 0) {
    throw new RangeError('comment body must not be empty');
  }
  return {
    id: input.id,
    targetElementId: input.targetElementId,
    authorParticipantId: input.authorParticipantId,
    authorInitials: input.authorInitials,
    body: trimmedBody,
    createdAtMs: input.createdAtMs,
    resolved: false,
    parentCommentId: input.parentCommentId ?? null,
  };
}
