# AOGRP binary envelope

A file begins with a fixed bootstrap header, two fixed recovery-root slots, alignment padding, and segments. The package demonstration uses an 8-byte transfer-safe magic, version numbers, file UUID, profile digest, and advisory active slot. Readers MUST select the highest-generation valid recovery root, not trust the advisory slot alone.

Each recovery root records generation, manifest offset and length, manifest hash, semantic root, segment count, flags, and checksum. Each segment records type, codec, stored and uncompressed length, object count, payload hash, and semantic digest.

Production field widths, byte order, magic, and IDs require ADR allocation.
