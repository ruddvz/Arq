# Deterministic encoding and hashes

Canonical identity payloads SHOULD use an accepted deterministic CBOR profile. The package demo uses a float-free deterministic JSON subset because no production codec is allocated. Maps reject duplicate keys, text policy is explicit, sets are sorted by canonical identifier, and hash preimages use domain tags plus length framing.

**Correction: the last sentence of the original text ("hash references
include algorithm and profile IDs") was false as a description of the
reference implementation** — `SB`/`SEG` struct hash fields are raw 32-byte
values with no adjacent algorithm-ID byte, and `canonical.py`'s `digest()`
hardcodes SHA-256. The algorithm is scoped to the whole file's `PROFILE`
string in the boot header, not tagged per hash reference. See
`research-v6/07_MERKLE_DAG_AND_HASH_AGILITY.md`'s correction for why
per-reference tagging (Git's actual model) isn't adopted here, and what
would need to change if it ever needs to be.
