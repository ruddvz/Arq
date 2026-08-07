from __future__ import annotations
import sqlite3
from pathlib import Path
from .format import object_record

# Finding 14 fix: normative-v6/20_MIGRATION_FROM_SQLITE_ARQ.md was three
# sentences of prose with zero corresponding code anywhere in this package.
# This is a bounded, honestly-scoped demo of the documented sequence -
# read-only source, fidelity report, never overwrite the only source -
# against a GENERIC SQLite schema, not Arq's actual production `.arq`
# schema. Deciding how AOGRP's object model maps onto Arq's real semantic
# entities (walls, levels, openings, and so on) is a real architecture
# decision - see TRIAGE-README.md findings 6-7 for why this reference
# package has no authority to make that call unilaterally. What this module
# proves is narrower and mechanical: that read-only inspection followed by
# row-to-object translation actually works end to end, not that any
# particular schema mapping is the right one.

class MigrationError(ValueError):
    pass


def inspect_sqlite_source(sqlite_path) -> dict:
    """Read-only fidelity report. Opens the source in SQLite's own read-only
    URI mode plus `PRAGMA query_only`, so a bug here cannot write to the
    source even if it tried to - matching the "never overwrites the only
    source" requirement the normative doc states but never implemented."""
    path = Path(sqlite_path)
    if not path.exists():
        raise MigrationError(f"source does not exist: {path}")
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        conn.execute("PRAGMA query_only=1")
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        ]
        report = {"source": str(path), "tables": {}}
        for table in tables:
            count = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            columns = [row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')]
            report["tables"][table] = {"row_count": count, "columns": columns}
        return report
    finally:
        conn.close()


def candidate_objects_from_table(sqlite_path, table: str, type_id: str, entity_id_column: str) -> list[dict]:
    """Translate one table's rows into AOGRP object records, one row per
    object. The caller supplies `type_id`/`entity_id_column` per table -
    this function does not hardcode what any table "means" semantically.
    That mapping decision belongs to whichever future work actually adopts
    a schema, not to this reference reader. Read-only, same as above."""
    path = Path(sqlite_path)
    if not path.exists():
        raise MigrationError(f"source does not exist: {path}")
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        conn.execute("PRAGMA query_only=1")
        columns = [row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')]
        if not columns:
            raise MigrationError(f"table not found: {table}")
        if entity_id_column not in columns:
            raise MigrationError(f"{entity_id_column!r} is not a column of {table!r}")
        rows = conn.execute(f'SELECT * FROM "{table}"').fetchall()
        objects = []
        for row in rows:
            payload = dict(zip(columns, row))
            entity_id = str(payload[entity_id_column])
            objects.append(object_record(type_id, entity_id, payload))
        return objects
    finally:
        conn.close()
