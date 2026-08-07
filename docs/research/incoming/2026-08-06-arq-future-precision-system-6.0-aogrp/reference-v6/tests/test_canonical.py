import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from arq6.canonical import *
class T(unittest.TestCase):
 def test_order(self): self.assertEqual(encode({"b":1,"a":2}),encode({"a":2,"b":1}))
 def test_float_rejected(self):
  with self.assertRaises(CanonicalError): encode({"x":1.0})
 def test_domain_separation(self): self.assertNotEqual(digest("a",b"x"),digest("b",b"x"))
if __name__=="__main__": unittest.main()
