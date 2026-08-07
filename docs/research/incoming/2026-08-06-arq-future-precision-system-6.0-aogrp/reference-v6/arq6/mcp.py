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
        p=self.proposals[pid]
        # Bug 2 fix: minting a token was never gated on the proposal's own status,
        # so approve() could be called again on an already-approved or already-
        # committed proposal, producing a second live token that independently
        # satisfies every check in consume() and replays the same operations.
        if p["status"]!="draft": raise McpError(f"proposal already {p['status']}, cannot re-approve")
        actual=self.digest(pid)
        if actual!=expected_digest: raise McpError("proposal digest mismatch")
        p["status"]="approved"; token=secrets.token_hex(24); self.approvals[token]={"pid":pid,"digest":actual,"expires":time.time()+ttl,"used":False}; return token
    def consume(self,token,pid,current_base_revision):
        a=self.approvals.get(token)
        if not a or a["used"] or a["expires"]<time.time(): raise McpError("invalid approval token")
        if a["pid"]!=pid or a["digest"]!=self.digest(pid): raise McpError("approval no longer matches")
        p=self.proposals[pid]
        # Bug 2 fix, defence in depth alongside approve()'s guard: a token is only
        # ever valid while its proposal is still "approved" - this independently
        # rejects a second still-live token after the first has already committed,
        # even if a future caller minted one before approve()'s guard existed.
        if p["status"]!="approved": raise McpError(f"proposal is {p['status']}, not approved")
        # Bug 3 fix (TOCTOU): the exact-digest binding covers the proposal payload
        # only, never the live project it will be applied to. A human can approve
        # against revision R while another writer advances the project past R
        # before this token is consumed (the ttl window is up to `ttl` seconds).
        # The caller must supply the actual current head revision at commit time,
        # and it must still match what was approved.
        if current_base_revision!=p["base_revision"]:
            raise McpError("base revision has moved since approval - re-propose and re-approve")
        a["used"]=True; p["status"]="committed"; return list(p["operations"])
