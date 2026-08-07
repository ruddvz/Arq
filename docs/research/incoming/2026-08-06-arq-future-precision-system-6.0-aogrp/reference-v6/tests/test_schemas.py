import unittest,json,sys
from pathlib import Path
import jsonschema
ROOT=Path(__file__).resolve().parents[2]
class T(unittest.TestCase):
 def test_meta(self):
  for p in (ROOT/"schemas-v6").glob("*.json"):
   jsonschema.Draft202012Validator.check_schema(json.loads(p.read_text()))
if __name__=="__main__": unittest.main()
