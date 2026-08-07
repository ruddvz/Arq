# AOGRP binary envelope

A file begins with a fixed bootstrap header, two fixed recovery-root slots, alignment padding, and segments. The package demonstration uses an 8-byte transfer-safe magic, version numbers, file UUID, profile digest, and advisory active slot. Readers MUST select the highest-generation valid recovery root, not trust the advisory slot alone.

**"Valid" means content-verified, not merely struct-checksum-verified.** A
root's own checksum covers only its 512-byte superblock struct, not the
manifest segment it points to — a root can be struct-intact while the
segment it references is truncated or corrupted. Readers MUST attempt every
candidate root in generation-descending order, fully resolving and
hash-verifying each one's target manifest segment, and fall back to the next
root on any failure; only fail once every root has been attempted and
rejected. `reference-v6/arq6/format.py`'s `open_manifest()` implements this
order (see `TRIAGE-README.md` finding 1 for the defect this corrects and its
regression tests).

Each recovery root records generation, manifest offset and length, manifest hash, semantic root, segment count, flags, and checksum. Each segment records type, codec, stored and uncompressed length, object count, payload hash, and semantic digest.

**Any conforming implementation MUST validate `offset + length` against the
containing file's size using checked or saturating arithmetic**, never plain
addition that can silently wrap on a fixed-width integer type. The reference
implementation is immune to this only because Python integers do not
overflow — that immunity is an accident of the reference language, not a
property of this specification, and MUST NOT be relied on by a byte-exact
implementation in C, Rust, or any other fixed-width-integer language. The
same requirement applies to the per-segment `stored_len`/`raw_len` budget
checks and to the aggregate decompressed-byte budget across a single
validation pass (`TRIAGE-README.md` finding 4).

Production field widths, byte order, magic, and IDs require ADR allocation.
