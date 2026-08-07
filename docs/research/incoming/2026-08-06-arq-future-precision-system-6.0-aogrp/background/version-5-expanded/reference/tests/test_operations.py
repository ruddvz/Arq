import unittest,uuid
from arq5.operations import ProjectState,apply_group,make_group,OperationError

class OperationTests(unittest.TestCase):
    def setUp(self): self.state=ProjectState(str(uuid.uuid4()))
    def test_atomic_success_creates_revision(self):
        oid=str(uuid.uuid4()); op={'operation_id':str(uuid.uuid4()),'type':'arq.demo/set-component','schema_version':1,'payload':{'object_id':oid,'schema_id':'arq.demo/name','payload':{'name':'A'}}}
        out=apply_group(self.state,make_group(self.state,[op]))
        self.assertNotEqual(out.revision,self.state.revision); self.assertEqual(len(out.history),1)
    def test_failure_leaves_original_unchanged(self):
        before=self.state.root(); op={'operation_id':str(uuid.uuid4()),'type':'arq.demo/delete-component','schema_version':1,'payload':{'object_id':str(uuid.uuid4()),'schema_id':'missing'}}
        with self.assertRaises(OperationError): apply_group(self.state,make_group(self.state,[op]))
        self.assertEqual(before,self.state.root()); self.assertEqual(self.state.history,[])
    def test_stale_base_rejected(self):
        g=make_group(self.state,[{'operation_id':str(uuid.uuid4()),'type':'arq.demo/set-component','schema_version':1,'payload':{'object_id':str(uuid.uuid4()),'schema_id':'x','payload':{}}}]); g['base_revision']='f'*64
        with self.assertRaisesRegex(OperationError,'stale'): apply_group(self.state,g)
