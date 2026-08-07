# Unknown data preservation

A reader may preserve unknown optional data only if it can retain the original canonical bytes, ownership links, ordering semantics where meaningful, and declared dependencies. It must not rewrite an unknown record through a generic JSON parse and reserialize path. Unknown required data blocks editable open. Unknown security-sensitive extension data may require quarantine even if marked optional.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
