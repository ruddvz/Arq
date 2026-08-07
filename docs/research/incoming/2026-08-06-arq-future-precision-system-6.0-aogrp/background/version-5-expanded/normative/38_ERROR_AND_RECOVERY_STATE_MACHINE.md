# Error and recovery state machine

Opening states are acquired, byte-preflighted, identified, capability-checked, migration-planned, isolated-open, deep-validated, hydrated, or failed. Failure states are unsupported, preserving-read-only, migration-required, repair-required, corrupt, quarantined, resource-limit, permission-denied, or internal. Every state defines allowed actions, source retention, evidence, and whether canonical writes are possible.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
