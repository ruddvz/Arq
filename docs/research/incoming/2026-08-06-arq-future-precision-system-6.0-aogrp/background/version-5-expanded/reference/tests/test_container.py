import sqlite3,tempfile,unittest
from pathlib import Path
from arq5.container import create_demo,validate,preflight,publish,ArqFileError,DEMO_APPLICATION_ID,sha256_file

class ContainerTests(unittest.TestCase):
    def setUp(self):
        self.td=tempfile.TemporaryDirectory(); self.root=Path(self.td.name)
        self.schema=Path(__file__).resolve().parents[2]/'sql'/'ARQ_V5_CANDIDATE_LOGICAL_SCHEMA.sql'
        self.source=self.root/'source.arq'; create_demo(self.source,self.schema)
    def tearDown(self): self.td.cleanup()
    def test_healthy_validates(self):
        self.assertTrue(validate(self.source)['validated'])
    def test_publish_reopens_and_matches_root(self):
        dest=self.root/'dest.arq'; result=publish(self.source,dest)
        self.assertTrue(result['promoted']); self.assertEqual(validate(self.source)['semantic_root'],validate(dest)['semantic_root'])
    def test_injected_failure_preserves_prior_destination(self):
        dest=self.root/'dest.arq'; create_demo(dest,self.schema); before=sha256_file(dest)
        with self.assertRaises(ArqFileError): publish(self.source,dest,fail_before_promote=True)
        self.assertEqual(before,sha256_file(dest))
    def test_wrong_application_id_rejected(self):
        bad=self.root/'bad.arq'; bad.write_bytes(self.source.read_bytes())
        con=sqlite3.connect(bad); con.execute('PRAGMA application_id=1'); con.close()
        with self.assertRaisesRegex(ArqFileError,'application ID'): preflight(bad)
    def test_unsupported_required_capability_is_preserving_only(self):
        bad=self.root/'future.arq'; bad.write_bytes(self.source.read_bytes())
        con=sqlite3.connect(bad); con.execute("INSERT INTO arq_capability VALUES('arq/future','1.0.0','required','opaque-byte-preserving','future')"); con.commit(); con.close()
        self.assertEqual(preflight(bad)['verdict'],'read-only-preserving')
    def test_missing_required_asset_rejected(self):
        bad=self.root/'asset.arq'; bad.write_bytes(self.source.read_bytes())
        con=sqlite3.connect(bad); con.execute("INSERT INTO arq_asset(asset_id,sha256,media_type,byte_length,role,required,data) VALUES(?,?,?,?,?,?,NULL)",('11111111-1111-4111-8111-111111111111','0'*64,'application/octet-stream',1,'canonical-source',1)); con.commit(); con.close()
        with self.assertRaisesRegex(ArqFileError,'required assets'): validate(bad)
