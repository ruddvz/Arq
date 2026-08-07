import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from arq6.mcp import *
class T(unittest.TestCase):
 def setUp(self): self.s=ProposalService(); self.g={"project":"p","base_revision":"r","operation_types":["wall.create"],"nonce":"n"}
 def test_lifecycle_and_replay(self):
  p=self.s.begin(self.g,"p","r"); self.s.add(p,self.g,{"kind":"wall.create","payload":{}}); d=self.s.digest(p); t=self.s.approve(p,d); self.assertEqual(len(self.s.consume(t,p)),1)
  with self.assertRaises(McpError): self.s.consume(t,p)
 def test_scope(self):
  with self.assertRaises(McpError): self.s.begin(self.g,"q","r")
 def test_operation_scope(self):
  p=self.s.begin(self.g,"p","r")
  with self.assertRaises(McpError): self.s.add(p,self.g,{"kind":"raw.sql","payload":{}})
if __name__=="__main__": unittest.main()
