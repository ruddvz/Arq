# Query, index, and cache policy

Canonical tables favour identity and correctness. Search, spatial, graph, geometry, render, and document indexes are derived with source revision and generator version. A stale index may reduce performance but cannot change accepted results. Queries that affect a commit must revalidate against canonical state. Cache eviction is never project deletion.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
