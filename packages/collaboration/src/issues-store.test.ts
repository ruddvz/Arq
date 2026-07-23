import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createIssue } from './issue';
import {
  addIssue,
  assignIssue,
  createIssuesDoc,
  listIssues,
  listIssuesAssignedTo,
  listIssuesByStatus,
  setIssueStatus,
  syncIssuesUpdate,
} from './issues-store';

const issueInput = {
  targetElementId: 'wall-1',
  authorParticipantId: 'alice',
  title: 'Wall thickness does not match schedule',
  createdAtMs: 1000,
};

describe('addIssue / listIssues (single document)', () => {
  it('adds and lists an issue', () => {
    const doc = createIssuesDoc();
    addIssue(doc, createIssue({ id: 'i1', ...issueInput }));
    expect(listIssues(doc)).toEqual([createIssue({ id: 'i1', ...issueInput })]);
  });

  it('lists issues oldest first regardless of insertion order', () => {
    const doc = createIssuesDoc();
    addIssue(doc, createIssue({ id: 'i2', ...issueInput, createdAtMs: 2000 }));
    addIssue(doc, createIssue({ id: 'i1', ...issueInput, createdAtMs: 1000 }));
    expect(listIssues(doc).map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('throws when adding an issue with an id that already exists', () => {
    const doc = createIssuesDoc();
    addIssue(doc, createIssue({ id: 'i1', ...issueInput }));
    expect(() => addIssue(doc, createIssue({ id: 'i1', ...issueInput }))).toThrow(RangeError);
  });

  it('setIssueStatus changes the status', () => {
    const doc = createIssuesDoc();
    addIssue(doc, createIssue({ id: 'i1', ...issueInput }));
    setIssueStatus(doc, 'i1', 'in-progress');
    expect(listIssues(doc)[0]?.status).toBe('in-progress');
    setIssueStatus(doc, 'i1', 'resolved');
    expect(listIssues(doc)[0]?.status).toBe('resolved');
  });

  it('setIssueStatus on an unknown issue id is a no-op, not an error', () => {
    const doc = createIssuesDoc();
    expect(() => setIssueStatus(doc, 'does-not-exist', 'closed')).not.toThrow();
    expect(listIssues(doc)).toEqual([]);
  });

  it('assignIssue sets and clears the assignee', () => {
    const doc = createIssuesDoc();
    addIssue(doc, createIssue({ id: 'i1', ...issueInput }));
    assignIssue(doc, 'i1', 'bob');
    expect(listIssues(doc)[0]?.assigneeParticipantId).toBe('bob');
    assignIssue(doc, 'i1', null);
    expect(listIssues(doc)[0]?.assigneeParticipantId).toBeNull();
  });

  it('listIssuesByStatus and listIssuesAssignedTo filter correctly', () => {
    const doc = createIssuesDoc();
    addIssue(doc, createIssue({ id: 'i1', ...issueInput }));
    addIssue(doc, createIssue({ id: 'i2', ...issueInput, createdAtMs: 1500 }));
    setIssueStatus(doc, 'i2', 'in-progress');
    assignIssue(doc, 'i2', 'bob');

    expect(listIssuesByStatus(doc, 'open').map((i) => i.id)).toEqual(['i1']);
    expect(listIssuesByStatus(doc, 'in-progress').map((i) => i.id)).toEqual(['i2']);
    expect(listIssuesAssignedTo(doc, 'bob').map((i) => i.id)).toEqual(['i2']);
  });
});

describe('syncIssuesUpdate (real cross-document CRDT merge)', () => {
  it('relays an issue added on one document to another', () => {
    const alice = createIssuesDoc();
    const bob = createIssuesDoc();
    addIssue(alice, createIssue({ id: 'i1', ...issueInput }));

    syncIssuesUpdate(alice, bob);

    expect(listIssues(bob)).toEqual(listIssues(alice));
  });

  it('preserves both issues when two peers concurrently add different issues (no destructive merge)', () => {
    const alice = createIssuesDoc();
    const bob = createIssuesDoc();
    syncIssuesUpdate(alice, bob);

    addIssue(alice, createIssue({ id: 'from-alice', ...issueInput, authorParticipantId: 'alice' }));
    addIssue(bob, createIssue({ id: 'from-bob', ...issueInput, authorParticipantId: 'bob' }));

    syncIssuesUpdate(alice, bob);
    syncIssuesUpdate(bob, alice);

    expect(
      listIssues(alice)
        .map((i) => i.id)
        .sort(),
    ).toEqual(['from-alice', 'from-bob']);
    expect(
      listIssues(bob)
        .map((i) => i.id)
        .sort(),
    ).toEqual(['from-alice', 'from-bob']);
  });

  it('converges to the same status on both peers after a concurrent status change on the same issue', () => {
    const alice = createIssuesDoc();
    const bob = createIssuesDoc();
    addIssue(alice, createIssue({ id: 'i1', ...issueInput }));
    syncIssuesUpdate(alice, bob);

    setIssueStatus(alice, 'i1', 'in-progress');
    setIssueStatus(bob, 'i1', 'closed');

    syncIssuesUpdate(alice, bob);
    syncIssuesUpdate(bob, alice);

    const aliceStatus = listIssues(alice)[0]?.status;
    const bobStatus = listIssues(bob)[0]?.status;
    expect(aliceStatus).toBe(bobStatus);
  });

  it('never throws when reading a document containing a malformed issue entry (defends against untrusted remote state)', () => {
    const doc = createIssuesDoc();
    const map = doc.getMap('issues');
    const malformed = new Y.Map<unknown>();
    malformed.set('id', 'bad');
    malformed.set('status', 'not-a-real-status'); // invalid enum value - should be skipped, not thrown
    map.set('bad', malformed);

    addIssue(doc, createIssue({ id: 'good', ...issueInput }));

    expect(() => listIssues(doc)).not.toThrow();
    expect(listIssues(doc).map((i) => i.id)).toEqual(['good']);
  });
});
