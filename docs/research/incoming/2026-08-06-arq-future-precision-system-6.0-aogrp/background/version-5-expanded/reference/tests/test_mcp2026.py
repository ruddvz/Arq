import unittest
from arq5.mcp2026 import PROTOCOL_VERSION, ProtocolError, StatelessRouter, parse_stateless_request

class MCP2026Tests(unittest.TestCase):
    def headers(self, method="tools/call", name="arq.proposal.begin"):
        h={"MCP-Protocol-Version":PROTOCOL_VERSION,"Mcp-Method":method}
        if name is not None: h["Mcp-Name"]=name
        return h
    def body(self, method="tools/call", name="arq.proposal.begin"):
        params={"_meta":{"io.modelcontextprotocol/clientInfo":{"name":"test","version":"1"},"io.modelcontextprotocol/clientCapabilities":{}},"arguments":{}}
        if name is not None: params["name"]=name
        return {"jsonrpc":"2.0","id":1,"method":method,"params":params}
    def test_valid_request_is_self_describing(self):
        c=parse_stateless_request(self.headers(),self.body())
        self.assertEqual(c.protocol_version,PROTOCOL_VERSION)
    def test_old_version_not_silently_accepted(self):
        h=self.headers(); h["MCP-Protocol-Version"]="2025-11-25"
        with self.assertRaisesRegex(ProtocolError,"unsupported"): parse_stateless_request(h,self.body())
    def test_header_body_method_mismatch_rejected(self):
        with self.assertRaisesRegex(ProtocolError,"disagree"): parse_stateless_request(self.headers(),self.body(method="resources/read",name=None))
    def test_header_body_tool_mismatch_rejected(self):
        with self.assertRaisesRegex(ProtocolError,"disagree"): parse_stateless_request(self.headers(name="arq.one"),self.body(name="arq.two"))
    def test_router_discovery_is_deterministic(self):
        r=StatelessRouter(); r.register_tool("arq.z",lambda a,c:a); r.register_tool("arq.a",lambda a,c:a)
        self.assertEqual(r.discover()["tools"],["arq.a","arq.z"])
    def test_router_calls_registered_tool(self):
        r=StatelessRouter(); r.register_tool("arq.proposal.begin",lambda a,c:{"ok":True,"client":c.client_name})
        self.assertTrue(r.handle(self.headers(),self.body())["result"]["ok"])
