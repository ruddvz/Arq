import unittest, tempfile, sqlite3
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from arq6.migrate import inspect_sqlite_source, candidate_objects_from_table, MigrationError
from arq6.format import create, deep_validate


class MigrateTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.db = Path(self.t.name) / "source.sqlite"
        conn = sqlite3.connect(self.db)
        conn.execute("CREATE TABLE walls (id TEXT PRIMARY KEY, length_mm INTEGER, height_mm INTEGER)")
        conn.executemany(
            "INSERT INTO walls VALUES (?, ?, ?)",
            [("wall-1", 5000, 2700), ("wall-2", 3200, 2700)],
        )
        conn.execute("CREATE TABLE rooms (id TEXT PRIMARY KEY, name TEXT)")
        conn.executemany("INSERT INTO rooms VALUES (?, ?)", [("room-1", "Kitchen")])
        conn.commit()
        conn.close()
        self.original_bytes = self.db.read_bytes()

    def tearDown(self):
        self.t.cleanup()

    def test_missing_source_rejected(self):
        with self.assertRaises(MigrationError):
            inspect_sqlite_source(Path(self.t.name) / "does-not-exist.sqlite")

    def test_fidelity_report_matches_source(self):
        report = inspect_sqlite_source(self.db)
        self.assertEqual(report["tables"]["walls"]["row_count"], 2)
        self.assertEqual(sorted(report["tables"]["walls"]["columns"]), ["height_mm", "id", "length_mm"])
        self.assertEqual(report["tables"]["rooms"]["row_count"], 1)

    def test_inspection_is_genuinely_read_only(self):
        # The whole point of "never overwrites the only source" - prove the
        # source file's bytes are byte-for-byte unchanged after inspection.
        inspect_sqlite_source(self.db)
        self.assertEqual(self.db.read_bytes(), self.original_bytes)

    def test_unknown_entity_id_column_rejected(self):
        with self.assertRaises(MigrationError):
            candidate_objects_from_table(self.db, "walls", "arq.wall", "not_a_real_column")

    def test_unknown_table_rejected(self):
        with self.assertRaises(MigrationError):
            candidate_objects_from_table(self.db, "not_a_real_table", "arq.wall", "id")

    def test_translated_objects_are_valid_and_survive_a_round_trip(self):
        # The end-to-end proof this finding asked for: rows read from SQLite
        # become real AOGRP objects that a fresh .arq6 file can hold and
        # deep_validate() will accept - not just a report on paper.
        wall_objects = candidate_objects_from_table(self.db, "walls", "arq.wall.demo", "id")
        self.assertEqual(len(wall_objects), 2)
        entity_ids = {o["body"]["entity_id"] for o in wall_objects}
        self.assertEqual(entity_ids, {"wall-1", "wall-2"})

        out = Path(self.t.name) / "migrated.arq6"
        create(out, wall_objects)
        state = deep_validate(out)
        self.assertTrue(state["validated"])
        self.assertEqual(len(state["objects"]), 2)

        self.assertEqual(self.db.read_bytes(), self.original_bytes)


if __name__ == "__main__":
    unittest.main()
