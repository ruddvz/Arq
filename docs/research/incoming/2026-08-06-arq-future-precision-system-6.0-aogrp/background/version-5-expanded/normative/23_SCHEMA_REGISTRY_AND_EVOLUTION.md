# Schema registry and evolution

Schema IDs, operation IDs, relation IDs, capability namespaces, evidence kinds, diagnostics, and domain packs require registries. Entries include owner, version, compatibility class, canonical encoding, validators, migrations, preservation policy, and deprecation state. A schema version change is not automatically a file-format version change. Readers must distinguish unknown required, unknown optional-preservable, and unknown disposable records.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
