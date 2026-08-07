from __future__ import annotations
import json,sqlite3,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'reference'))
from arq5.container import create_demo,publish,validate,preflight,ArqFileError

FIX=ROOT/'fixtures'; SCHEMA=ROOT/'sql'/'ARQ_V5_CANDIDATE_LOGICAL_SCHEMA.sql'
FIX.mkdir(exist_ok=True)
for p in FIX.glob('*.arq'): p.unlink()
healthy=FIX/'healthy_demo.arq'; create_demo(healthy,SCHEMA)
publish(healthy,FIX/'published_demo.arq')

wrong=FIX/'wrong_application_id.arq'; wrong.write_bytes(healthy.read_bytes()); c=sqlite3.connect(wrong); c.execute('PRAGMA application_id=1'); c.close()
trunc=FIX/'truncated.arq'; trunc.write_bytes(healthy.read_bytes()[:512])
non=FIX/'non_sqlite.arq'; non.write_bytes(b'not sqlite'+b'\0'*1024)
future=FIX/'unsupported_required_capability.arq'; future.write_bytes(healthy.read_bytes()); c=sqlite3.connect(future); c.execute("INSERT INTO arq_capability VALUES('arq/future','1.0.0','required','opaque-byte-preserving','future')"); c.commit(); c.close()
optional=FIX/'unknown_optional_capability.arq'; optional.write_bytes(healthy.read_bytes()); c=sqlite3.connect(optional); c.execute("INSERT INTO arq_capability VALUES('arq/optional-future','1.0.0','optional','opaque-byte-preserving','future optional')"); c.commit(); c.close()
asset=FIX/'missing_required_asset.arq'; asset.write_bytes(healthy.read_bytes()); c=sqlite3.connect(asset); c.execute("INSERT INTO arq_asset(asset_id,sha256,media_type,byte_length,role,required,data) VALUES(?,?,?,?,?,?,NULL)",('11111111-1111-4111-8111-111111111111','0'*64,'application/octet-stream',1,'canonical-source',1)); c.commit(); c.close()
rootbad=FIX/'wrong_semantic_root.arq'; rootbad.write_bytes(healthy.read_bytes()); c=sqlite3.connect(rootbad); c.execute("UPDATE arq_publication SET semantic_root=?",('f'*64,)); c.commit(); c.close()
missing=FIX/'missing_project_table.arq'; missing.write_bytes(healthy.read_bytes()); c=sqlite3.connect(missing); c.execute('PRAGMA foreign_keys=OFF'); c.execute('DROP TABLE arq_project'); c.commit(); c.close()
fk=FIX/'foreign_key_violation.arq'; fk.write_bytes(healthy.read_bytes()); c=sqlite3.connect(fk); c.execute('PRAGMA foreign_keys=OFF'); oid=c.execute('SELECT object_id FROM arq_object LIMIT 1').fetchone()[0]; c.execute('DELETE FROM arq_object WHERE object_id=?',(oid,)); c.commit(); c.close()

def verdict(path,deep=True):
    try:
        r=validate(path) if deep else preflight(path); return {'state':'accepted','verdict':r.get('verdict'),'code':None}
    except ArqFileError as e: return {'state':'rejected','verdict':None,'code':e.code}
    except sqlite3.Error: return {'state':'rejected','verdict':None,'code':'SQLITE-ERROR'}
expected={
 'healthy_demo.arq':verdict(healthy),
 'published_demo.arq':verdict(FIX/'published_demo.arq'),
 'wrong_application_id.arq':verdict(wrong),
 'truncated.arq':verdict(trunc),
 'non_sqlite.arq':verdict(non),
 'unsupported_required_capability.arq':verdict(future,False),
 'unknown_optional_capability.arq':verdict(optional,False),
 'missing_required_asset.arq':verdict(asset),
 'wrong_semantic_root.arq':verdict(rootbad),
 'missing_project_table.arq':verdict(missing),
 'foreign_key_violation.arq':verdict(fk),
}
(FIX/'EXPECTED_VERDICTS.json').write_text(json.dumps(expected,indent=2,sort_keys=True)+'\n')

mcp=FIX/'mcp'; mcp.mkdir(exist_ok=True)
valid={"headers":{"MCP-Protocol-Version":"2026-07-28","Mcp-Method":"tools/call","Mcp-Name":"arq.proposal.begin"},"body":{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"arq.proposal.begin","arguments":{},"_meta":{"io.modelcontextprotocol/clientInfo":{"name":"fixture-client","version":"1.0"},"io.modelcontextprotocol/clientCapabilities":{}}}}}
(mcp/'valid_stateless_tool_call.json').write_text(json.dumps(valid,indent=2)+'\n')
old=json.loads(json.dumps(valid)); old['headers']['MCP-Protocol-Version']='2025-11-25'
(mcp/'legacy_version_rejected_by_primary_profile.json').write_text(json.dumps(old,indent=2)+'\n')
mismatch=json.loads(json.dumps(valid)); mismatch['headers']['Mcp-Name']='arq.other'
(mcp/'tool_header_mismatch.json').write_text(json.dumps(mismatch,indent=2)+'\n')
print(json.dumps(expected,indent=2,sort_keys=True))
