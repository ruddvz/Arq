import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from arq6.mcp import *
class T(unittest.TestCase):
 def setUp(self): self.s=ProposalService(); self.g={"project":"p","base_revision":"r","operation_types":["wall.create"],"nonce":"n"}
 def test_lifecycle_and_replay(self):
  p=self.s.begin(self.g,"p","r"); self.s.add(p,self.g,{"kind":"wall.create","payload":{}}); d=self.s.digest(p); t=self.s.approve(p,d); self.assertEqual(len(self.s.consume(t,p,"r")),1)
  with self.assertRaises(McpError): self.s.consume(t,p,"r")
 def test_scope(self):
  with self.assertRaises(McpError): self.s.begin(self.g,"q","r")
 def test_operation_scope(self):
  p=self.s.begin(self.g,"p","r")
  with self.assertRaises(McpError): self.s.add(p,self.g,{"kind":"raw.sql","payload":{}})
 def test_reapproval_minting_a_second_token_is_rejected(self):
  # Bug 2 regression: approve() must not mint a second live token for a proposal
  # that's already approved - that second token would otherwise let the same
  # operations be consumed (replayed) a second time after the first commit.
  p=self.s.begin(self.g,"p","r"); self.s.add(p,self.g,{"kind":"wall.create","payload":{}}); d=self.s.digest(p)
  t1=self.s.approve(p,d)
  with self.assertRaises(McpError): self.s.approve(p,d)
  self.assertEqual(len(self.s.consume(t1,p,"r")),1)
 def test_consume_after_status_desync_is_rejected(self):
  # Bug 2 regression, defence-in-depth path: consume() itself must refuse a token
  # whose proposal is no longer "approved", independent of approve()'s own guard.
  p=self.s.begin(self.g,"p","r"); self.s.add(p,self.g,{"kind":"wall.create","payload":{}}); d=self.s.digest(p)
  t=self.s.approve(p,d); self.s.consume(t,p,"r")
  self.s.approvals[t]["used"]=False
  with self.assertRaises(McpError): self.s.consume(t,p,"r")
 def test_stale_base_revision_is_rejected(self):
  # Bug 3 regression (TOCTOU): an approved token must not commit against a
  # project that has moved past the revision it was approved for.
  p=self.s.begin(self.g,"p","r"); self.s.add(p,self.g,{"kind":"wall.create","payload":{}}); d=self.s.digest(p)
  t=self.s.approve(p,d)
  with self.assertRaises(McpError): self.s.consume(t,p,"r2")
if __name__=="__main__": unittest.main()
