# @arq/sync-protocol

Local-first replica and operation sync protocol (ADR-0021, ARQ-206-209). Pure logic
only - `apps/api` is still a stub, so this is deliberately not a real network client;
it is what a future real server/client implementation must behave like, verified
here as testable logic rather than left undefined.

- **`operation-envelope.ts`** (ARQ-206): `OperationEnvelope` (client-authored,
  carries a stable `operationId` idempotency key and the `baseRevision` it was
  authored against) and `ServerSequencedOperation` (server-assigned
  `serverSequence` - the canonical, project-wide order every replica reconciles to).
- **`idempotent-upload.ts`** (ARQ-207): `createIdempotentOperationStore` - a retried
  upload of the exact same envelope is a safe no-op returning the original result;
  the same `operationId` reused with _different_ content is rejected outright rather
  than silently returning the first result.
- **`resumable-chunk-upload.ts`** (ARQ-208): `createChunkUploadSession` - built on
  `@arq/arqfs`'s content-addressed chunks (ARQ-199). A resuming client asks which
  chunk indices are still missing and sends only those, not the whole resource
  again; a chunk re-sent with a different hash at an already-accepted index is
  rejected rather than silently overwriting a verified chunk.
- **`conflict-classification.ts` + `safe-rebase.ts`** (ARQ-209): operations are
  described only by which entity IDs they wrote/deleted (not their full semantic
  type, keeping this package decoupled from `@arq/operations`/`@arq/arqscript`).
  `classifyConflict` distinguishes `concurrent-write` from the more severe
  `write-after-delete`. `computeSafeRebasePlan` classifies each client operation
  independently against the server operations since its `baseRevision` - a
  conflicted operation is reported explicitly, never silently reapplied or dropped.

**Explicit scope boundary**: `computeSafeRebasePlan` does not chase transitive
dependency chains between a client's own pending operations (e.g. operation B
assumed operation A's effect, A conflicted, so B might now be unsafe too even
though B itself touches nothing server-side changed) - that needs real operation
semantics this generic module does not have.
