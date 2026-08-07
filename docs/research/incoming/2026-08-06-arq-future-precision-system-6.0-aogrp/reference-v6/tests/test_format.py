import unittest,tempfile,copy,os
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from arq6.format import *

class FormatTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(); self.p=Path(self.t.name)/"p.arq"
  self.objects=[object_record("arq.wall","wall-1",{"length":{"coefficient":5000,"scale":0,"unit":"mm"}})]
  self.ops=[operation_record("wall.create",{"entity_id":"wall-1"})]
  create(self.p,self.objects,self.ops)
 def tearDown(self): self.t.cleanup()
 def test_magic(self): self.assertEqual(self.p.read_bytes()[:8],MAGIC)
 def test_deep(self): self.assertTrue(deep_validate(self.p)["validated"])
 def test_no_sqlite_header(self): self.assertNotEqual(self.p.read_bytes()[:16],b"SQLite format 3\x00")
 def test_append(self):
  old=deep_validate(self.p)["manifest"]; append_revision(self.p,[object_record("arq.room","room-1",{"name":"A"})]); new=deep_validate(self.p)["manifest"]
  self.assertEqual(new["generation"],2); self.assertNotEqual(old["semantic_root"],new["semantic_root"])
 def test_failed_append_keeps_old_root(self):
  old=deep_validate(self.p)["manifest"]["semantic_root"]
  with self.assertRaises(RuntimeError): append_revision(self.p,[object_record("arq.room","room-2",{"name":"B"})],fail_before_root=True)
  self.assertEqual(deep_validate(self.p)["manifest"]["semantic_root"],old)
 def test_one_superblock_corrupt_recovers(self):
  append_revision(self.p,[object_record("arq.room","room-1",{"name":"A"})])
  with self.p.open("r+b") as f: f.seek(BOOT_SIZE); f.write(b"X"*SB_SIZE)
  self.assertEqual(open_manifest(self.p)["manifest"]["generation"],2)
 def test_both_superblocks_corrupt_fail(self):
  with self.p.open("r+b") as f: f.seek(BOOT_SIZE); f.write(b"X"*(SB_SIZE*2))
  with self.assertRaises(ArqFormatError): open_manifest(self.p)
 def test_bad_magic(self):
  b=bytearray(self.p.read_bytes()); b[0]=0; q=Path(self.t.name)/"bad.arq"; q.write_bytes(b)
  with self.assertRaises(ArqFormatError): open_manifest(q)
 def test_truncated(self):
  q=Path(self.t.name)/"trunc.arq"; q.write_bytes(self.p.read_bytes()[:100])
  with self.assertRaises(ArqFormatError): open_manifest(q)
 def test_unknown_required_read_only(self):
  q=Path(self.t.name)/"u.arq"; create(q,self.objects,self.ops,required=list(SUPPORTED_REQUIRED)+["arq.future.x"])
  self.assertEqual(open_manifest(q)["mode"],"preserving-read-only")
 def test_optional_unknown_editable(self):
  q=Path(self.t.name)/"o.arq"; create(q,self.objects,self.ops,optional=["arq.future.optional"])
  self.assertEqual(open_manifest(q)["mode"],"editable")
 def test_compact_publish(self):
  append_revision(self.p,[object_record("arq.room","room-1",{"name":"A"})]); q=Path(self.t.name)/"out.arq"; compact_publish(self.p,q)
  self.assertEqual(deep_validate(self.p)["manifest"]["semantic_root"],deep_validate(q)["manifest"]["semantic_root"])
 def test_failed_publish_preserves_destination(self):
  q=Path(self.t.name)/"out.arq"; q.write_bytes(b"existing")
  with self.assertRaises(RuntimeError): compact_publish(self.p,q,True)
  self.assertEqual(q.read_bytes(),b"existing")
 def test_corrupt_segment(self):
  st=open_manifest(self.p); off=st["manifest"]["segments"][0]["offset"]+SEG.size
  with self.p.open("r+b") as f: f.seek(off); x=f.read(1); f.seek(off); f.write(bytes([x[0]^1]))
  with self.assertRaises(Exception): deep_validate(self.p)

if __name__=="__main__": unittest.main()
