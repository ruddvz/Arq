# Migration from current SQLite `.arq`

Migration is source preserving. The converter opens the source read-only, records its file hash and format identity, reads current repository schemas, emits canonical ARQ objects and revisions, validates the AOGRP candidate, materialises it back into an isolated current-format candidate where possible, and produces a fidelity report. It never overwrites the only source.

**Implementation status, and what it deliberately does not claim.**
`reference-v6/arq6/migrate.py` implements the read-only-source and
fidelity-report parts of this sequence for real:
`inspect_sqlite_source()` opens the source with SQLite's own read-only URI
mode plus `PRAGMA query_only`, enumerates tables/row counts/columns, and is
proven byte-for-byte non-mutating by
`test_inspection_is_genuinely_read_only`; `candidate_objects_from_table()`
translates rows into real AOGRP object records that a fresh `.arq6` file
accepts and `deep_validate()` confirms, end to end
(`test_translated_objects_are_valid_and_survive_a_round_trip`).

What it does **not** do, and should not be read as claiming: it does not
read Arq's actual production `.arq` schema (`packages/arqfs`), and it does
not decide how AOGRP's object model maps onto Arq's real semantic entities
(walls, levels, openings, hosted relationships, and so on). The reference's
`candidate_objects_from_table()` takes `type_id`/`entity_id_column` as
caller-supplied arguments precisely because that mapping is a real
architecture decision this reference package has no authority to make —
see `TRIAGE-README.md` findings 6–7. This demo proves the mechanical
sequence works; it is not evidence that a specific schema mapping, or
migration from Arq's actual `.arq` files, is safe or correct.
