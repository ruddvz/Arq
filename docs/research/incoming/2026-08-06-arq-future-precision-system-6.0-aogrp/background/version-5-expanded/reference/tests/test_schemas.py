import json,unittest
from pathlib import Path
from jsonschema import Draft202012Validator

class SchemaTests(unittest.TestCase):
    def test_all_schemas_pass_meta_validation(self):
        root=Path(__file__).resolve().parents[2]/'schemas'
        files=list(root.glob('*.json')); self.assertGreaterEqual(len(files),15)
        for p in files: Draft202012Validator.check_schema(json.loads(p.read_text()))
