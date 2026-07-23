/**
 * ARQ-164: collaboration: implement issues.
 *
 * Same pattern as comments-store.ts (ARQ-163) applied to Issue: a real
 * Yjs Y.Map CRDT document rather than ephemeral Awareness state, since an
 * issue is persistent structured metadata like a comment is, not
 * geometry. "Destructive conflicts are not silently merged" holds for
 * the same reason comments' does: adding an issue is purely additive
 * (verified directly, same as comments), and status/assignee changes
 * only ever touch that one issue's own fields - never another issue's,
 * and never its title/description/author history.
 *
 * `listIssues` treats every entry as potentially untrusted, same trust
 * boundary as comments-store.ts's `listComments`.
 */

import * as Y from 'yjs';
import type { Issue, IssueStatus } from './issue';

const ISSUES_MAP_NAME = 'issues';
const ISSUE_STATUSES: ReadonlySet<string> = new Set(['open', 'in-progress', 'resolved', 'closed']);

export function createIssuesDoc(): Y.Doc {
  return new Y.Doc();
}

function issuesMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(ISSUES_MAP_NAME);
}

/** Adds a brand-new issue. Throws if this exact id already exists in this document - a local misuse guard, not a network race: callers are expected to supply globally-unique ids (e.g. UUIDs). */
export function addIssue(doc: Y.Doc, issue: Issue): void {
  const map = issuesMap(doc);
  if (map.has(issue.id)) {
    throw new RangeError(`issue ${issue.id} already exists`);
  }
  const entry = new Y.Map<unknown>();
  entry.set('id', issue.id);
  entry.set('targetElementId', issue.targetElementId);
  entry.set('authorParticipantId', issue.authorParticipantId);
  entry.set('title', issue.title);
  entry.set('description', issue.description);
  entry.set('status', issue.status);
  entry.set('assigneeParticipantId', issue.assigneeParticipantId);
  entry.set('createdAtMs', issue.createdAtMs);
  map.set(issue.id, entry);
}

/** Sets one issue's status. A no-op (never throws) for an unknown or already-removed issue id - a stale reference from a concurrent removal is not an error. */
export function setIssueStatus(doc: Y.Doc, issueId: string, status: IssueStatus): void {
  const entry = issuesMap(doc).get(issueId);
  if (entry === undefined) {
    return;
  }
  entry.set('status', status);
}

/** Reassigns one issue; pass null to unassign. A no-op for an unknown issue id. */
export function assignIssue(
  doc: Y.Doc,
  issueId: string,
  assigneeParticipantId: string | null,
): void {
  const entry = issuesMap(doc).get(issueId);
  if (entry === undefined) {
    return;
  }
  entry.set('assigneeParticipantId', assigneeParticipantId);
}

function isIssueStatus(value: unknown): value is IssueStatus {
  return typeof value === 'string' && ISSUE_STATUSES.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Defensively parses one Y.Map entry into an Issue; returns null for anything malformed rather than throwing - a remote peer's document state is untrusted input. */
function parseIssueEntry(entry: Y.Map<unknown>): Issue | null {
  const id = entry.get('id');
  const targetElementId = entry.get('targetElementId');
  const authorParticipantId = entry.get('authorParticipantId');
  const title = entry.get('title');
  const description = entry.get('description');
  const status = entry.get('status');
  const assigneeParticipantId = entry.get('assigneeParticipantId');
  const createdAtMs = entry.get('createdAtMs');

  if (
    typeof id !== 'string' ||
    !(typeof targetElementId === 'string' || targetElementId === null) ||
    typeof authorParticipantId !== 'string' ||
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !isIssueStatus(status) ||
    !(typeof assigneeParticipantId === 'string' || assigneeParticipantId === null) ||
    !isFiniteNumber(createdAtMs)
  ) {
    return null;
  }

  return {
    id,
    targetElementId,
    authorParticipantId,
    title,
    description,
    status,
    assigneeParticipantId,
    createdAtMs,
  };
}

/** Every issue in the document, oldest first. A malformed entry is skipped rather than rejecting the whole read. */
export function listIssues(doc: Y.Doc): readonly Issue[] {
  const results: Issue[] = [];
  for (const entry of issuesMap(doc).values()) {
    const parsed = parseIssueEntry(entry);
    if (parsed !== null) {
      results.push(parsed);
    }
  }
  return results.sort((a, b) => a.createdAtMs - b.createdAtMs);
}

export function listIssuesByStatus(doc: Y.Doc, status: IssueStatus): readonly Issue[] {
  return listIssues(doc).filter((issue) => issue.status === status);
}

export function listIssuesAssignedTo(doc: Y.Doc, assigneeParticipantId: string): readonly Issue[] {
  return listIssues(doc).filter((issue) => issue.assigneeParticipantId === assigneeParticipantId);
}

/** Relays only what `source` has that `target` does not yet, exactly as comments-store.ts's syncCommentsUpdate does. */
export function syncIssuesUpdate(source: Y.Doc, target: Y.Doc): void {
  const update = Y.encodeStateAsUpdate(source, Y.encodeStateVector(target));
  Y.applyUpdate(target, update, 'sync');
}
