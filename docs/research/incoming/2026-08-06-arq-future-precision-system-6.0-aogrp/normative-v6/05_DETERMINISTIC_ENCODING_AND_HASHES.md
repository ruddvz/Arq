# Deterministic encoding and hashes

Canonical identity payloads SHOULD use an accepted deterministic CBOR profile. The package demo uses a float-free deterministic JSON subset because no production codec is allocated. Maps reject duplicate keys, text policy is explicit, sets are sorted by canonical identifier, and hash preimages use domain tags plus length framing. Hash references include algorithm and profile IDs.
