import tempfile,unittest
from pathlib import Path
from arq5.container import create_demo,ArqFileError
from arq5.inspector import bounded_header_preflight,portable_sidecar_check

class InspectorTests(unittest.TestCase):
    def setUp(self):
        self.td=tempfile.TemporaryDirectory(); self.root=Path(self.td.name)
        self.schema=Path(__file__).resolve().parents[2]/"sql"/"ARQ_V5_CANDIDATE_LOGICAL_SCHEMA.sql"
        self.path=self.root/"demo.arq"; create_demo(self.path,self.schema)
    def tearDown(self): self.td.cleanup()
    def test_header_fields_read_without_opening_sql(self):
        info=bounded_header_preflight(self.path)
        self.assertTrue(info["demo_application_id_match"]); self.assertGreaterEqual(info["page_size"],512)
    def test_non_sqlite_rejected(self):
        bad=self.root/"bad.arq"; bad.write_bytes(b"x"*200)
        with self.assertRaisesRegex(ArqFileError,"header"): bounded_header_preflight(bad)
    def test_sidecar_rejected_for_portable_file(self):
        Path(str(self.path)+"-wal").write_bytes(b"x")
        with self.assertRaisesRegex(ArqFileError,"sidecars"): portable_sidecar_check(self.path)
