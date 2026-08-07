from __future__ import annotations
import hashlib,hmac,secrets,time,uuid
from dataclasses import dataclass,field
from typing import Any
from .canonical import canonical_bytes,digest

class MCPDomainError(RuntimeError): pass

@dataclass
class Grant:
    grant_id:str; project_id:str; base_revision:str; audience:str
    allowed_operations:set[str]; expires_at:float; nonce:str
    max_operations:int=100; used:bool=False

@dataclass
class Proposal:
    proposal_id:str; grant_id:str; project_id:str; base_revision:str
    operations:list[dict[str,Any]]=field(default_factory=list)
    state:str='draft'; digest_value:str=''

class DomainService:
    def __init__(self,secret:bytes|None=None):
        self.secret=secret or secrets.token_bytes(32); self.grants={}; self.proposals={}; self.used_tokens=set()
    def issue_grant(self,project_id,base_revision,audience,allowed_operations,ttl=300,max_operations=100):
        g=Grant(str(uuid.uuid4()),project_id,base_revision,audience,set(allowed_operations),time.time()+ttl,secrets.token_hex(16),max_operations)
        self.grants[g.grant_id]=g; return g
    def begin(self,grant_id,audience):
        g=self._grant(grant_id,audience)
        p=Proposal(str(uuid.uuid4()),g.grant_id,g.project_id,g.base_revision)
        self.proposals[p.proposal_id]=p; self._refresh(p); return p
    def add_operation(self,proposal_id,audience,op):
        p=self.proposals[proposal_id]; g=self._grant(p.grant_id,audience)
        if p.state!='draft': raise MCPDomainError('proposal not draft')
        if op['type'] not in g.allowed_operations: raise MCPDomainError('operation not granted')
        if len(p.operations)>=g.max_operations: raise MCPDomainError('operation limit')
        p.operations.append(op); self._refresh(p); return p
    def validate(self,proposal_id,audience,current_revision):
        p=self.proposals[proposal_id]; self._grant(p.grant_id,audience)
        if current_revision!=p.base_revision: p.state='stale'; raise MCPDomainError('stale proposal')
        if not p.operations: raise MCPDomainError('empty proposal')
        p.state='validated'; self._refresh(p); return p
    def submit(self,proposal_id,audience):
        p=self.proposals[proposal_id]; self._grant(p.grant_id,audience)
        if p.state!='validated': raise MCPDomainError('not validated')
        p.state='submitted'; self._refresh(p); return p
    def host_approve(self,proposal_id,current_revision,ttl=60):
        p=self.proposals[proposal_id]
        if p.state!='submitted' or p.base_revision!=current_revision: raise MCPDomainError('cannot approve')
        p.state='approved'; self._refresh(p)
        exp=int(time.time()+ttl); nonce=secrets.token_hex(16)
        body=f'{p.proposal_id}|{p.digest_value}|{p.project_id}|{p.base_revision}|{exp}|{nonce}'
        sig=hmac.new(self.secret,body.encode(),hashlib.sha256).hexdigest()
        return body+'|'+sig
    def host_commit(self,token,current_revision):
        if token in self.used_tokens: raise MCPDomainError('approval replay')
        parts=token.split('|')
        if len(parts)!=7: raise MCPDomainError('bad token')
        proposal_id,pdigest,project,base,exp,nonce,sig=parts
        body='|'.join(parts[:-1]); expected=hmac.new(self.secret,body.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig,expected): raise MCPDomainError('bad signature')
        if time.time()>int(exp): raise MCPDomainError('expired approval')
        p=self.proposals[proposal_id]
        live_digest=self._calculate(p)
        if p.state!='approved' or p.digest_value!=pdigest or live_digest!=pdigest or p.project_id!=project or p.base_revision!=base: raise MCPDomainError('proposal changed')
        if current_revision!=base: p.state='stale'; raise MCPDomainError('stale at commit')
        self.used_tokens.add(token); p.state='committed'; self._refresh(p)
        return {'proposal_id':proposal_id,'operations':p.operations,'digest':pdigest}
    def _calculate(self,p):
        return digest('mcp-proposal-v1',{'proposal_id':p.proposal_id,'grant_id':p.grant_id,'project_id':p.project_id,'base_revision':p.base_revision,'operations':p.operations,'state':p.state})
    def _refresh(self,p):
        p.digest_value=self._calculate(p)
    def _grant(self,grant_id,audience):
        g=self.grants[grant_id]
        if time.time()>g.expires_at: raise MCPDomainError('grant expired')
        if audience!=g.audience: raise MCPDomainError('wrong audience')
        return g
