# @arq/import-export-worker

Off-main-thread import processing: a typed request/response protocol
(`protocol.ts`), a driver-agnostic handler over `@arq/file-ingress`'s
conversion pipeline (`handler.ts`, unit-tested), the default adapter
registry, and the Worker runtime wiring (`worker-runtime.ts`).

Not yet integrated: no app constructs this worker, so no import runs
end to end in the product (`apps/web`'s file-open flow stops at its
compatibility verdict). Export processing (PDF/glTF) is not implemented
here yet - `@arq/pdf-export` exists as a library with no caller.
