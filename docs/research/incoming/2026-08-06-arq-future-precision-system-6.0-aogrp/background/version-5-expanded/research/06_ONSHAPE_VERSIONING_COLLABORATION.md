# Onshape versioning and collaboration research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

Onshape is evaluated for document history, mutable workspaces, immutable versions, branching, merging, releases, and repair-oriented collaboration workflows.

## Verified source observations

- Onshape distinguishes mutable workspaces from immutable versions and allows branches and merges within a document history.
- Cloud history can record changes continuously, but semantic merge remains domain-aware and can require repair after conflicting edits.
- Immutable versions provide stable references for releases and external dependencies.
- Collaboration quality depends on identity, permissions, change attribution, conflict visibility, and recovery, not only real-time cursors.

## Lessons for `.arq`

- ARQ should distinguish working state, saved portable publication, immutable revision, named branch, and released baseline.
- External references should pin immutable revisions by default and make floating references explicit.
- Merge results should be new operation groups with conflict evidence, not hidden database reconciliation.

## Gaps ARQ can address

- ARQ can make offline-first portable ownership compatible with later cloud collaboration.
- ARQ can provide semantically grouped undo across human and AI changes.
- ARQ can expose dependency and downstream invalidation before accepting a merge.

## Primary sources consulted

- Onshape document management help, EXT-ONSHAPE.

## Limits

- Server internals were not inspected.
- Onshape workflows are product examples, not an open file-format specification.
