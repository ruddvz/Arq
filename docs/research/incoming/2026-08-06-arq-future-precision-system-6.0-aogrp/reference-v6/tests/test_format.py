import unittest,tempfile,copy,os
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from arq6.format import *
from arq6.format import _unpack_sb  # leading-underscore helper, not covered by import *

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
 def test_newer_root_content_corrupt_falls_back_to_older_root(self):
  # Bug 1 regression: a superblock's checksum covers only its own struct, not the
  # manifest segment it points to. If the newest root's struct is intact but the
  # segment *content* it references is corrupted, the reader must fall back to
  # the older, still content-valid root instead of failing outright - that is
  # the entire point of having two recovery roots. The pre-existing fixtures only
  # ever corrupted the older slot's superblock struct, never this case.
  append_revision(self.p,[object_record("arq.room","room-1",{"name":"A"})])
  with self.p.open("rb") as f:
   f.seek(BOOT_SIZE+1*SB_SIZE); newer=_unpack_sb(f.read(SB_SIZE))
  self.assertEqual(newer["generation"],2)
  corrupt_at=newer["manifest_offset"]+SEG.size
  with self.p.open("r+b") as f:
   f.seek(corrupt_at); byte=f.read(1); f.seek(corrupt_at); f.write(bytes([byte[0]^1]))
  result=open_manifest(self.p)
  self.assertEqual(result["manifest"]["generation"],1)
  self.assertEqual(result["root_slot"],0)
 def test_both_roots_content_corrupt_fail(self):
  # Every candidate root must be exhausted, in generation order, before giving up.
  append_revision(self.p,[object_record("arq.room","room-1",{"name":"A"})])
  for slot in (0,1):
   with self.p.open("rb") as f:
    f.seek(BOOT_SIZE+slot*SB_SIZE); sb=_unpack_sb(f.read(SB_SIZE))
   at=sb["manifest_offset"]+SEG.size
   with self.p.open("r+b") as f:
    f.seek(at); byte=f.read(1); f.seek(at); f.write(bytes([byte[0]^1]))
  with self.assertRaises(ArqFormatError): open_manifest(self.p)
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
 def test_aggregate_decompression_budget_enforced(self):
  # Bug 4 regression: many segments each within the per-segment cap must still be
  # bounded in aggregate - a per-segment-only check lets a validation pass
  # decompress far more total data than any single limit suggests (a zip-bomb-
  # style amplification path), since deep_validate() decompresses every segment
  # fully into memory before checking any running total.
  class TinyBudgetLimits(Limits):
   max_total_uncompressed=1
  with self.assertRaises(ArqFormatError):
   deep_validate(self.p,limits=TinyBudgetLimits)
 def test_corrupt_segment(self):
  st=open_manifest(self.p); off=st["manifest"]["segments"][0]["offset"]+SEG.size
  with self.p.open("r+b") as f: f.seek(off); x=f.read(1); f.seek(off); f.write(bytes([x[0]^1]))
  with self.assertRaises(Exception): deep_validate(self.p)

if __name__=="__main__": unittest.main()
