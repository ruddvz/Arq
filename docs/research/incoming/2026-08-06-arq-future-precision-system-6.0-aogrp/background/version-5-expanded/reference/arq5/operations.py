from __future__ import annotations
import copy, uuid
from dataclasses import dataclass, field
from typing import Any
from .canonical import digest, state_root

class OperationError(RuntimeError): pass

@dataclass
class ProjectState:
    project_id: str
    components: dict[tuple[str,str],dict[str,Any]]=field(default_factory=dict)
    relations: dict[str,dict[str,Any]]=field(default_factory=dict)
    revision: str='0'*64
    history: list[dict[str,Any]]=field(default_factory=list)

    def root(self)->str:
        return state_root(list(self.components.values()),list(self.relations.values()))

def apply_group(state:ProjectState, group:dict[str,Any])->ProjectState:
    if group['project_id']!=state.project_id: raise OperationError('wrong project')
    if group['base_revision']!=state.revision: raise OperationError('stale base revision')
    candidate=copy.deepcopy(state)
    try:
        for op in group['operations']:
            typ=op['type']; p=op['payload']
            if typ=='arq.demo/set-component':
                key=(p['object_id'],p['schema_id'])
                expected=p.get('expected_payload_digest')
                if expected:
                    old=candidate.components.get(key)
                    if old is None or digest('component-payload-v1',old['payload'])!=expected: raise OperationError('precondition failed')
                candidate.components[key]={'object_id':p['object_id'],'schema_id':p['schema_id'],'schema_version':p.get('schema_version',1),'payload':p['payload']}
            elif typ=='arq.demo/delete-component':
                key=(p['object_id'],p['schema_id'])
                if key not in candidate.components: raise OperationError('component missing')
                del candidate.components[key]
            elif typ=='arq.demo/add-relation':
                if p['relation_id'] in candidate.relations: raise OperationError('relation exists')
                candidate.relations[p['relation_id']]=p
            else: raise OperationError('unsupported operation')
        newroot=candidate.root()
        gid=group['group_id']
        candidate.revision=digest('revision-v1',{'parents':[state.revision],'group_id':gid,'state_root':newroot})
        candidate.history.append({'group_id':gid,'parent':state.revision,'revision':candidate.revision,'state_root':newroot})
        return candidate
    except Exception:
        if state.root()!=state.root(): raise AssertionError('unreachable')
        raise

def make_group(state:ProjectState,operations:list[dict[str,Any]])->dict[str,Any]:
    return {'group_id':str(uuid.uuid4()),'project_id':state.project_id,'base_revision':state.revision,'actor':{'class':'human','id':'test'},'operations':operations}
