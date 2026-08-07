# Authority and conflict audit

## Storage conflict

The public status describes both SQLite-WASM over OPFS and Dexie over IndexedDB. These may be complementary if one is a temporary operation journal and the other is the canonical working database, but that boundary is not established by the available evidence.

A resolution ADR must answer:

- Which store acknowledges accepted operations?
- Which store is authoritative after crash recovery?
- How are two stores reconciled?
- Is dual write allowed?
- What happens if only one write succeeds?
- Which store drives portable publication?
- How are migrations coordinated?
- How is multi-tab writer ownership enforced?
- When is the transitional store removed?

## 3D status conflict

One line reports a real 3D view. A later line reports no 3D view and zero consumers. The status file must be corrected against current code and browser evidence.

## ADR numbering collision

The Operator OS snapshot records an ADR-0027 collision. Do not create new ADR files until current HEAD and the ADR index are reconciled.
