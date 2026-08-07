from __future__ import annotations
import time, secrets
from .canonical import hex_digest

class McpError(ValueError): pass
class ProposalService:
    def __init__(self): self.proposals={}; self.approvals={}
    def begin(self,grant,project,base_revision):
        if grant["project"]!=project or grant["base_revision"]!=base_revision: raise McpError("grant scope mismatch")
        pid=secrets.token_hex(16); self.proposals[pid]={"project":project,"base_revision":base_revision,"operations":[],"status":"draft","grant_nonce":grant["nonce"]}; return pid
    def add(self,pid,grant,operation):
        p=self.proposals[pid]
        if p["status"]!="draft": raise McpError("proposal not mutable")
        if operation["kind"] not in grant["operation_types"]: raise McpError("operation not granted")
        p["operations"].append(operation)
    def digest(self,pid):
        p=self.proposals[pid]; return hex_digest("arq6-proposal-v1",{"project":p["project"],"base_revision":p["base_revision"],"operations":p["operations"]})
    def approve(self,pid,expected_digest,ttl=60):
        actual=self.digest(pid)
        if actual!=expected_digest: raise McpError("proposal digest mismatch")
        p=self.proposals[pid]; p["status"]="approved"; token=secrets.token_hex(24); self.approvals[token]={"pid":pid,"digest":actual,"expires":time.time()+ttl,"used":False}; return token
    def consume(self,token,pid):
        a=self.approvals.get(token)
        if not a or a["used"] or a["expires"]<time.time(): raise McpError("invalid approval token")
        if a["pid"]!=pid or a["digest"]!=self.digest(pid): raise McpError("approval no longer matches")
        a["used"]=True; self.proposals[pid]["status"]="committed"; return list(self.proposals[pid]["operations"])
