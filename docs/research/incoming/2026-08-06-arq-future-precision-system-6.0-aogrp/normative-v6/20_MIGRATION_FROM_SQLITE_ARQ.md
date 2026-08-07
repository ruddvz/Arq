# Migration from current SQLite `.arq`

Migration is source preserving. The converter opens the source read-only, records its file hash and format identity, reads current repository schemas, emits canonical ARQ objects and revisions, validates the AOGRP candidate, materialises it back into an isolated current-format candidate where possible, and produces a fidelity report. It never overwrites the only source.
