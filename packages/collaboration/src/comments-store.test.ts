import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createComment } from './comment';
import {
  addComment,
  createCommentsDoc,
  listComments,
  listReplies,
  listTopLevelComments,
  setCommentResolved,
  syncCommentsUpdate,
} from './comments-store';

const commentInput = {
  targetElementId: 'wall-1',
  authorParticipantId: 'alice',
  authorInitials: 'AL',
  body: 'Should this wall be load-bearing?',
  createdAtMs: 1000,
};

describe('addComment / listComments (single document)', () => {
  it('adds and lists a comment', () => {
    const doc = createCommentsDoc();
    addComment(doc, createComment({ id: 'c1', ...commentInput }));
    expect(listComments(doc)).toEqual([createComment({ id: 'c1', ...commentInput })]);
  });

  it('lists comments oldest first regardless of insertion order', () => {
    const doc = createCommentsDoc();
    addComment(doc, createComment({ id: 'c2', ...commentInput, createdAtMs: 2000 }));
    addComment(doc, createComment({ id: 'c1', ...commentInput, createdAtMs: 1000 }));
    expect(listComments(doc).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('throws when adding a comment with an id that already exists', () => {
    const doc = createCommentsDoc();
    addComment(doc, createComment({ id: 'c1', ...commentInput }));
    expect(() => addComment(doc, createComment({ id: 'c1', ...commentInput }))).toThrow(RangeError);
  });

  it('separates top-level comments from replies', () => {
    const doc = createCommentsDoc();
    addComment(doc, createComment({ id: 'c1', ...commentInput }));
    addComment(
      doc,
      createComment({ id: 'c2', ...commentInput, parentCommentId: 'c1', createdAtMs: 1500 }),
    );
    expect(listTopLevelComments(doc).map((c) => c.id)).toEqual(['c1']);
    expect(listReplies(doc, 'c1').map((c) => c.id)).toEqual(['c2']);
  });

  it('setCommentResolved toggles the resolved flag', () => {
    const doc = createCommentsDoc();
    addComment(doc, createComment({ id: 'c1', ...commentInput }));
    setCommentResolved(doc, 'c1', true);
    expect(listComments(doc)[0]?.resolved).toBe(true);
    setCommentResolved(doc, 'c1', false);
    expect(listComments(doc)[0]?.resolved).toBe(false);
  });

  it('setCommentResolved on an unknown comment id is a no-op, not an error', () => {
    const doc = createCommentsDoc();
    expect(() => setCommentResolved(doc, 'does-not-exist', true)).not.toThrow();
    expect(listComments(doc)).toEqual([]);
  });
});

describe('syncCommentsUpdate (real cross-document CRDT merge)', () => {
  it('relays a comment added on one document to another', () => {
    const alice = createCommentsDoc();
    const bob = createCommentsDoc();
    addComment(alice, createComment({ id: 'c1', ...commentInput }));

    syncCommentsUpdate(alice, bob);

    expect(listComments(bob)).toEqual(listComments(alice));
  });

  it('preserves both comments when two peers concurrently add different comments (no destructive merge)', () => {
    const alice = createCommentsDoc();
    const bob = createCommentsDoc();
    // Establish a shared starting point first, as two peers of the same document would.
    syncCommentsUpdate(alice, bob);

    addComment(
      alice,
      createComment({ id: 'from-alice', ...commentInput, authorParticipantId: 'alice' }),
    );
    addComment(bob, createComment({ id: 'from-bob', ...commentInput, authorParticipantId: 'bob' }));

    syncCommentsUpdate(alice, bob);
    syncCommentsUpdate(bob, alice);

    const aliceIds = listComments(alice)
      .map((c) => c.id)
      .sort();
    const bobIds = listComments(bob)
      .map((c) => c.id)
      .sort();
    expect(aliceIds).toEqual(['from-alice', 'from-bob']);
    expect(bobIds).toEqual(['from-alice', 'from-bob']);
  });

  it('converges to the same resolved value on both peers after a concurrent resolve/reopen on the same comment', () => {
    const alice = createCommentsDoc();
    const bob = createCommentsDoc();
    addComment(alice, createComment({ id: 'c1', ...commentInput }));
    syncCommentsUpdate(alice, bob);

    setCommentResolved(alice, 'c1', false);
    setCommentResolved(bob, 'c1', true);

    syncCommentsUpdate(alice, bob);
    syncCommentsUpdate(bob, alice);

    const aliceResolved = listComments(alice)[0]?.resolved;
    const bobResolved = listComments(bob)[0]?.resolved;
    expect(aliceResolved).toBe(bobResolved);
  });

  it('never throws when reading a document containing a malformed comment entry (defends against untrusted remote state)', () => {
    const doc = createCommentsDoc();
    const map = doc.getMap('comments');
    const malformed = new Y.Map<unknown>();
    malformed.set('id', 'bad');
    malformed.set('body', 42); // wrong type - should be skipped, not thrown
    map.set('bad', malformed);

    addComment(doc, createComment({ id: 'good', ...commentInput }));

    expect(() => listComments(doc)).not.toThrow();
    expect(listComments(doc).map((c) => c.id)).toEqual(['good']);
  });
});
