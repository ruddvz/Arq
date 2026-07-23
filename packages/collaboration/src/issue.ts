/**
 * ARQ-164: collaboration: implement issues.
 *
 * The blueprint consistently lists "comments" and "issues" as siblings,
 * not one nested inside the other (section 38's panel list, "Release 2:
 * exchange and review", "Review" purpose list) - an Issue is a distinct,
 * trackable review item with its own status workflow and optional
 * assignee, not just a comment with extra fields. Deliberately mirrors
 * comment.ts's shape and validation approach (throws on genuinely invalid
 * direct construction input, e.g. an empty title) rather than inventing a
 * different convention for a sibling concept.
 *
 * No dependency on @arq/bim-core: `targetElementId`/`assigneeParticipantId`
 * are plain strings, matching every other cross-boundary module in this
 * backlog.
 */

export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export interface Issue {
  readonly id: string;
  /** null means a general/project-level issue, not attached to any specific element. */
  readonly targetElementId: string | null;
  readonly authorParticipantId: string;
  readonly title: string;
  readonly description: string;
  readonly status: IssueStatus;
  readonly assigneeParticipantId: string | null;
  readonly createdAtMs: number;
}

export interface CreateIssueInput {
  readonly id: string;
  readonly targetElementId: string | null;
  readonly authorParticipantId: string;
  readonly title: string;
  readonly description?: string;
  readonly assigneeParticipantId?: string | null;
  readonly createdAtMs: number;
}

/** Constructs a new, open, unassigned Issue; rejects an empty (or whitespace-only) title. */
export function createIssue(input: CreateIssueInput): Issue {
  const trimmedTitle = input.title.trim();
  if (trimmedTitle.length === 0) {
    throw new RangeError('issue title must not be empty');
  }
  return {
    id: input.id,
    targetElementId: input.targetElementId,
    authorParticipantId: input.authorParticipantId,
    title: trimmedTitle,
    description: input.description?.trim() ?? '',
    status: 'open',
    assigneeParticipantId: input.assigneeParticipantId ?? null,
    createdAtMs: input.createdAtMs,
  };
}
