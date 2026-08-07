# Candidate decision register

| ID | Decision | State | Rationale | Repository action |
|---|---|---|---|---|
| ARQ5-D01 | Use SQLite as candidate portable container | Proposed | Mature transactional single-file application format with inspection and backup support | Reconcile current format and browser build |
| ARQ5-D02 | Keep semantic model authoritative over kernel payloads | Proposed | Prevents kernel lock-in and opaque geometry ownership | Accept ADR before schema work |
| ARQ5-D03 | Use exact scaled quantities canonically | Proposed | Avoids unstable floating-point identity | Benchmark range and overflow policy |
| ARQ5-D04 | Use deterministic CBOR candidate encoding | Proposed | Stable binary representation and hashing | Build two independent encoders |
| ARQ5-D05 | One accepted operation group creates one revision | Proposed | Atomic provenance and grouped undo | Reconcile with current operation engine |
| ARQ5-D06 | Never merge SQLite pages or raw B-Rep | Proposed | Merge belongs at semantic operation level | Implement conflict model |
| ARQ5-D07 | Publish by copy-on-write candidate and fresh reopen | Proposed | Protects source from partial save and migration | Implement first vertical slice |
| ARQ5-D08 | Use capabilities, not schema number alone | Proposed | Supports domain packs and read-only preservation | Allocate registry governance |
| ARQ5-D09 | AI writes only through reviewed proposals | Proposed | Maintains user control and deterministic validation | Integrate Review Centre and MCP |
| ARQ5-D10 | Federate large projects with pinned child revisions | Proposed | Avoids giant monolithic city or programme files | Defer until core publication is verified |
