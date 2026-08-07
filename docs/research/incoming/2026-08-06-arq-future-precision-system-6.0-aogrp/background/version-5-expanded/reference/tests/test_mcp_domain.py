import unittest,uuid
from arq5.mcp_domain import DomainService,MCPDomainError

class MCPTests(unittest.TestCase):
    def setUp(self):
        self.s=DomainService(b'x'*32); self.project=str(uuid.uuid4()); self.rev='a'*64; self.aud='client-1'
        self.g=self.s.issue_grant(self.project,self.rev,self.aud,{'arq.demo/set-component'})
    def proposal(self):
        p=self.s.begin(self.g.grant_id,self.aud)
        self.s.add_operation(p.proposal_id,self.aud,{'operation_id':str(uuid.uuid4()),'type':'arq.demo/set-component','schema_version':1,'payload':{'object_id':str(uuid.uuid4()),'schema_id':'x','payload':{}}})
        self.s.validate(p.proposal_id,self.aud,self.rev); self.s.submit(p.proposal_id,self.aud); return p
    def test_exact_proposal_commits_once(self):
        p=self.proposal(); token=self.s.host_approve(p.proposal_id,self.rev); result=self.s.host_commit(token,self.rev)
        self.assertEqual(result['proposal_id'],p.proposal_id)
        with self.assertRaisesRegex(MCPDomainError,'replay'): self.s.host_commit(token,self.rev)
    def test_wrong_audience_rejected(self):
        with self.assertRaisesRegex(MCPDomainError,'audience'): self.s.begin(self.g.grant_id,'other')
    def test_stale_validation_rejected(self):
        p=self.s.begin(self.g.grant_id,self.aud)
        self.s.add_operation(p.proposal_id,self.aud,{'operation_id':str(uuid.uuid4()),'type':'arq.demo/set-component','schema_version':1,'payload':{}})
        with self.assertRaisesRegex(MCPDomainError,'stale'): self.s.validate(p.proposal_id,self.aud,'b'*64)
    def test_mutation_after_approval_rejected(self):
        p=self.proposal(); token=self.s.host_approve(p.proposal_id,self.rev)
        p.operations.append({'operation_id':str(uuid.uuid4()),'type':'arq.demo/set-component','schema_version':1,'payload':{}})
        with self.assertRaisesRegex(MCPDomainError,'changed'): self.s.host_commit(token,self.rev)
