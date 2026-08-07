# Merkle DAG and hash agility

Merkle DAGs allow a revision root to verify all referenced content. ARQ revisions can use the same principle for semantic components, operation groups, assets, and evidence. SHA-256 is the package demonstration, not an irrevocable production choice.

**Correction — this is not Git's hash-agility model, and claiming it invited
a real defect.** An independent review found the reference implementation's
`SB` and `SEG` structs store `manifest_hash`, `semantic_root`, and
`payload_hash` as raw 32-byte fields with no adjacent algorithm-ID byte
anywhere, and `canonical.py`'s `digest()` hardcodes SHA-256 — the opposite
of "hash identifiers must include an algorithm code." Implementing true
per-hash-field algorithm tagging (Git's actual model: two hash algorithms
coexist across the same object store during a transition window, with a
persistent bidirectional ID mapping) is disproportionate for AOGRP as
specified: unlike Git's distributed, long-lived, cross-repository object
store, a single `.arq6` file has exactly one writer's current profile at any
moment, gated by the boot header's `profile_hash`
(`normative-v6/01_AOGRP_BINARY_ENVELOPE.md`). **The actual, honest mechanism
this format has is profile-level version gating, not per-object dual-hash
coexistence**: a hash-algorithm change is a new `PROFILE` string, which
`_read_boot()` already rejects on mismatch — the same mechanism that gates
any other breaking format change, not a distinct hash-agility feature. A
genuine multi-writer, long-lived hash transition (the scenario Git's design
actually solves) would only become relevant if AOGRP were adopted for
federation/partial-clone (`normative-v6/15_FEDERATION_PARTIAL_CLONE_AND_
LOD.md`) — at which point this document should be revisited with a real
per-object scheme, not before.
