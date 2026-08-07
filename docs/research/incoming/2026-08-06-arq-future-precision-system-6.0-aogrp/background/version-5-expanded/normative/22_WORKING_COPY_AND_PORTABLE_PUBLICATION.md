# Working copy and portable publication

The working copy may use browser-specific storage and journals. The portable file is a clean publication. A conforming writer must identify the accepted source revision, snapshot transactionally, write a separate candidate, force portable journal state, close it, reopen through a new read-only connection, run integrity and semantic validation, compare the canonical root, verify required assets and capabilities, then promote atomically. Failure must preserve the source and prior destination. Live WAL or SHM sidecars cannot be required to open the portable publication.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
