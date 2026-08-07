# Review Centre protocol

Review binds the proposal digest, project, base revision, operation list, assumptions, warnings, affected objects, document impact, analysis evidence, and expiry. Any change invalidates approval. The host issues a one-time approval token. Commit rechecks the digest, current revision, grant, permissions, operation schemas, preconditions, and invariants. Rejection and expiration are audit events but not canonical project revisions.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
