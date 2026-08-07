import json,unittest,sys
from pathlib import Path
from arq5.container import validate,preflight,ArqFileError
from arq5.mcp2026 import parse_stateless_request,ProtocolError

class FixtureTests(unittest.TestCase):
    def setUp(self):
        self.root=Path(__file__).resolve().parents[2]
        self.fix=self.root/'fixtures'
    def test_expected_arq_verdicts_match(self):
        expected=json.loads((self.fix/'EXPECTED_VERDICTS.json').read_text())
        for name,e in expected.items():
            p=self.fix/name
            try:
                r=preflight(p) if name in {'unsupported_required_capability.arq','unknown_optional_capability.arq'} else validate(p)
                actual={'state':'accepted','verdict':r.get('verdict'),'code':None}
            except ArqFileError as ex:
                actual={'state':'rejected','verdict':None,'code':ex.code}
            except Exception:
                actual={'state':'rejected','verdict':None,'code':'SQLITE-ERROR'}
            self.assertEqual(actual,e,name)
    def test_mcp_wire_fixtures(self):
        valid=json.loads((self.fix/'mcp/valid_stateless_tool_call.json').read_text())
        self.assertEqual(parse_stateless_request(valid['headers'],valid['body']).name,'arq.proposal.begin')
        for name in ['legacy_version_rejected_by_primary_profile.json','tool_header_mismatch.json']:
            x=json.loads((self.fix/'mcp'/name).read_text())
            with self.assertRaises(ProtocolError): parse_stateless_request(x['headers'],x['body'])
