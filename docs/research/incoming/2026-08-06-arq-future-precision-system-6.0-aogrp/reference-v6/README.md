# Package-local AOGRP reference

This Python implementation demonstrates a custom `.arq` envelope without SQLite. It is deliberately small and is not a production format implementation.

It supports:

- Transfer-safe magic and bounded bootstrap.
- Two checksummed recovery roots.
- Append-only typed segments.
- Deterministic float-free JSON object payloads.
- SHA-256 domain-separated content IDs.
- Manifest and semantic-root verification.
- Unknown capability modes.
- Append revision and fallback after interrupted append.
- Compact copy-on-write publication.
- Healthy and damaged fixtures.

The package profile, magic, IDs, and layout are not production allocations.

Run:

```bash
python -m unittest discover -s reference-v6/tests -v
python reference-v6/arq6/cli.py inspect fixtures-v6/healthy.aogrp.arq
```
