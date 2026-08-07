# Backup, recovery, and repair

Recovery replays acknowledged operation groups from the last verified checkpoint. Repair always creates a new candidate and never overwrites the source. Reports distinguish recovered, reconstructed, omitted, ambiguous, and unrecoverable data. A successful SQLite integrity check does not prove semantic integrity. A repaired file receives a new publication record and preserves source hashes.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
