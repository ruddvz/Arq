/**
 * ARQ-163: collaboration: implement comments.
 *
 * Backs Comment (comment.ts) with a real Yjs Y.Map CRDT document - unlike
 * ARQ-162's presence (deliberately ephemeral, via y-protocols' Awareness),
 * comments are persistent structured metadata, exactly the "comments"
 * candidate use blueprint section 83 names for Yjs directly ("Good
 * candidate for: presence; comments; rich text; lightweight shared
 * metadata... Do not store the entire B-rep or building model as a naive
 * Yjs document"). A comment thread is metadata, not geometry, so a Yjs
 * document is the right tool here - the same library, a different part
 * of it than ARQ-162 used.
 *
 * "Destructive conflicts are not silently merged" (section 82 stage 3:
 * "no silent destructive merge") holds for the operations this module
 * actually exposes: adding a comment is purely additive (verified
 * directly - two peers concurrently adding different comments and then
 * syncing both ways preserves both, never drops one for the other), and
 * resolving/reopening a comment only ever changes that one comment's own
 * `resolved` flag, never another comment's content. A concurrent resolve
 * vs. reopen on the very same comment converges (both peers agree on one
 * final value, standard Y.Map per-key CRDT semantics) rather than
 * diverging or crashing - which value wins is not caller-controllable,
 * but no comment's text is ever lost or corrupted by it.
 *
 * `listComments` treats every entry as potentially untrusted (a remote
 * peer's Yjs update, same trust boundary as ARQ-162's
 * parsePresenceState): a malformed entry is skipped, never thrown.
 */

import * as Y from 'yjs';
import type { Comment } from './comment';

const COMMENTS_MAP_NAME = 'comments';

export function createCommentsDoc(): Y.Doc {
  return new Y.Doc();
}

function commentsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(COMMENTS_MAP_NAME);
}

/** Adds a brand-new comment. Throws if this exact id already exists in this document - a local misuse guard, not a network race: callers are expected to supply globally-unique ids (e.g. UUIDs). */
export function addComment(doc: Y.Doc, comment: Comment): void {
  const map = commentsMap(doc);
  if (map.has(comment.id)) {
    throw new RangeError(`comment ${comment.id} already exists`);
  }
  const entry = new Y.Map<unknown>();
  entry.set('id', comment.id);
  entry.set('targetElementId', comment.targetElementId);
  entry.set('authorParticipantId', comment.authorParticipantId);
  entry.set('authorInitials', comment.authorInitials);
  entry.set('body', comment.body);
  entry.set('createdAtMs', comment.createdAtMs);
  entry.set('resolved', comment.resolved);
  entry.set('parentCommentId', comment.parentCommentId);
  map.set(comment.id, entry);
}

/** Sets one comment's resolved flag. A no-op (never throws) for an unknown or already-removed comment id - a stale reference from a concurrent removal is not an error. */
export function setCommentResolved(doc: Y.Doc, commentId: string, resolved: boolean): void {
  const entry = commentsMap(doc).get(commentId);
  if (entry === undefined) {
    return;
  }
  entry.set('resolved', resolved);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Defensively parses one Y.Map entry into a Comment; returns null for anything malformed rather than throwing - a remote peer's document state is untrusted input. */
function parseCommentEntry(entry: Y.Map<unknown>): Comment | null {
  const id = entry.get('id');
  const targetElementId = entry.get('targetElementId');
  const authorParticipantId = entry.get('authorParticipantId');
  const authorInitials = entry.get('authorInitials');
  const body = entry.get('body');
  const createdAtMs = entry.get('createdAtMs');
  const resolved = entry.get('resolved');
  const parentCommentId = entry.get('parentCommentId');

  if (
    typeof id !== 'string' ||
    !(typeof targetElementId === 'string' || targetElementId === null) ||
    typeof authorParticipantId !== 'string' ||
    typeof authorInitials !== 'string' ||
    typeof body !== 'string' ||
    !isFiniteNumber(createdAtMs) ||
    typeof resolved !== 'boolean' ||
    !(typeof parentCommentId === 'string' || parentCommentId === null)
  ) {
    return null;
  }

  return {
    id,
    targetElementId,
    authorParticipantId,
    authorInitials,
    body,
    createdAtMs,
    resolved,
    parentCommentId,
  };
}

/** Every comment in the document, oldest first. A malformed entry is skipped rather than rejecting the whole read. */
export function listComments(doc: Y.Doc): readonly Comment[] {
  const results: Comment[] = [];
  for (const entry of commentsMap(doc).values()) {
    const parsed = parseCommentEntry(entry);
    if (parsed !== null) {
      results.push(parsed);
    }
  }
  return results.sort((a, b) => a.createdAtMs - b.createdAtMs);
}

export function listTopLevelComments(doc: Y.Doc): readonly Comment[] {
  return listComments(doc).filter((comment) => comment.parentCommentId === null);
}

export function listReplies(doc: Y.Doc, parentCommentId: string): readonly Comment[] {
  return listComments(doc).filter((comment) => comment.parentCommentId === parentCommentId);
}

/**
 * Relays only what `source` has that `target` does not yet (Yjs's own
 * state-vector diffing), exactly as a real transport would - exercises
 * the genuine CRDT merge rather than sharing objects in-process.
 */
export function syncCommentsUpdate(source: Y.Doc, target: Y.Doc): void {
  const update = Y.encodeStateAsUpdate(source, Y.encodeStateVector(target));
  Y.applyUpdate(target, update, 'sync');
}
