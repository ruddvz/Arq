# @arq/collaboration

Presence, comments, and operation sync (Yjs for metadata; typed operations for geometry, per §16.6).

`presence-state.ts` + `presence-awareness.ts` (ARQ-162) prototype blueprint
section 85 ("Presence") - participant initials, active view, selection
where permitted, cursor in same view, and idle state - over the real
`y-protocols` Awareness protocol (`open-source/TECHNOLOGY-MATRIX.csv`/
`.json` already recorded Yjs with treatment "spike" and note "Presence and
comments"; this is exactly that spike). Operation sync (real geometry
edits) is separate, later work.

`comment.ts` + `comments-store.ts` (ARQ-163) implement comments - a
different part of Yjs than presence: comments are persistent structured
metadata (section 83: "Do not store the entire B-rep or building model as
a naive Yjs document" - a comment thread is exactly the kind of metadata
that document _is_ meant for), backed by a real `Y.Map` CRDT document
rather than ephemeral Awareness state. Threading (`parentCommentId`),
resolve/reopen, and a `targetElementId` (matching
`docs/commands/specs/CMD-095-add-comment.md`'s "target and body" inputs)
are all supported; the full command lifecycle (permission checks, undo,
model-dependency invalidation) that CMD-095 itself describes is separate,
later work.

- **No destructive merge, by construction**: Awareness only ever lets a
  client write its own state; a remote participant's entry is replaced
  wholesale by that client's own newer update, or removed entirely on
  disconnect - never merged across participants.
- **"Offline" has no status value of its own** - it is a participant's
  simple absence from the awareness map once Awareness removes them
  (explicit disconnect or its own timeout). Only `'active'` and `'idle'`
  are real derived statuses (`presence-state.ts`).
- **"Selection where permitted"**: the real authorization decision needs a
  server that does not exist in this repository yet
  (`security/THREAT-MODEL.md`: "No permission system is implemented yet").
  `buildVisiblePresence` takes an `isSelectionPermitted` predicate and
  correctly hides selection whenever it says no - the real, tested
  contribution here is that the client-side gate is wired correctly, not
  that server-side enforcement exists.
- **Untrusted remote state**: `parsePresenceState` treats every remote
  participant's Awareness state as untrusted input (same trust boundary as
  `@arq/project-format`'s `importArchive` or `@arq/dxf-adapter`'s
  `parseDxf`) - a malformed entry is skipped, never thrown. `comments-store.ts`'s
  `listComments` applies the same defensive parsing to a remote peer's
  Yjs comment entries.
- **Comments' "no silent destructive merge"**: verified directly against
  the real library, not assumed - two peers concurrently adding different
  comments and syncing both ways preserves both (never drops one), and a
  concurrent resolve-vs-reopen on the very same comment converges to one
  agreed value on both peers rather than diverging, crashing, or losing
  the comment's own text.

`issue.ts` + `issues-store.ts` (ARQ-164) implement issues - a distinct
review item from a comment (the blueprint consistently lists "comments"
and "issues" as siblings, e.g. the "Review" purpose list and "Release 2:
exchange and review"), with its own status workflow
(`'open' | 'in-progress' | 'resolved' | 'closed'`) and optional assignee,
following comments-store.ts's exact same Y.Map CRDT pattern and the same
"no silent destructive merge" guarantees (verified the same way: parallel
concurrent-add and concurrent-status-change tests).

New dependencies: `yjs` (MIT) and `y-protocols` (MIT), both scoped to this
package only.
