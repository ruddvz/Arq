# @arq/collaboration

Presence, comments, and operation sync (Yjs for metadata; typed operations for geometry, per §16.6).

`presence-state.ts` + `presence-awareness.ts` (ARQ-162) prototype blueprint
section 85 ("Presence") - participant initials, active view, selection
where permitted, cursor in same view, and idle state - over the real
`y-protocols` Awareness protocol (`open-source/TECHNOLOGY-MATRIX.csv`/
`.json` already recorded Yjs with treatment "spike" and note "Presence and
comments"; this is exactly that spike). Comments and operation sync (the
CRDT document-sync half of that note) are separate, later work.

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
  `parseDxf`) - a malformed entry is skipped, never thrown.

New dependencies: `yjs` (MIT) and `y-protocols` (MIT), both scoped to this
package only.
