from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXPECTED_ROOT='ARQ_FUTURE_PRECISION_FILE_SYSTEM_5.0_2026-08-06'

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''):h.update(c)
    return h.hexdigest()

def main():
    errors=[]
    if ROOT.name!=EXPECTED_ROOT: errors.append('package root mismatch')
    required=['00_README_FIRST.md','01_EXECUTIVE_VERDICT.md','03_CURRENT_ARQ_STATE_2026-08-06.md','current-state/STANDARDS_SNAPSHOT.json','normative/26_MCP_2026_07_28_WIRE_PROFILE.md','mcp/00_MCP_2026_07_28_ARCHITECTURE.md','handoff/ZEUS_TASK_HANDOFF.yaml','reference/arq5/mcp2026.py','fixtures/EXPECTED_VERDICTS.json','background/prior_package/ARQ_FUTURE_PRECISION_FILE_SYSTEM_4.0_2026-08-05.zip']
    for rel in required:
        if not (ROOT/rel).is_file(): errors.append('missing required file: '+rel)
    for p in ROOT.rglob('*'):
        if p.is_file():
            rel=p.relative_to(ROOT).as_posix()
            if p.suffix=='.pyc' or '__pycache__' in p.parts: errors.append('generated Python cache: '+rel)
            if p.name in {'.DS_Store','Thumbs.db'} or p.name.endswith('~'): errors.append('generated platform file: '+rel)
            if p.suffix.lower() in {'.md','.py','.json','.csv','.yaml','.yml','.sql','.txt','.ts'}:
                try:s=p.read_text(encoding='utf-8')
                except UnicodeDecodeError: errors.append('invalid UTF-8: '+rel); continue
                if chr(0x2014) in s: errors.append('em dash character: '+rel)
    inv=json.loads((ROOT/'PACKAGE_INVENTORY.json').read_text(encoding='utf-8'))
    actual=[]
    for p in sorted(ROOT.rglob('*')):
        if p.is_file() and p.name not in {'PACKAGE_INVENTORY.json','MANIFEST_SHA256.txt'}:
            actual.append({'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
    if actual!=inv['files']: errors.append('inventory mismatch')
    if inv['stats']['actual_total_file_count']!=len(actual)+2: errors.append('inventory total mismatch')
    manifest={}
    for line in (ROOT/'MANIFEST_SHA256.txt').read_text(encoding='utf-8').splitlines():
        if line.strip():
            digest,path=line.split('  ',1); manifest[path]=digest
    for p in sorted(ROOT.rglob('*')):
        if p.is_file() and p.name!='MANIFEST_SHA256.txt':
            rel=p.relative_to(ROOT).as_posix()
            if manifest.get(rel)!=sha(p): errors.append('manifest mismatch: '+rel)
    expected_manifest_entries=sum(1 for p in ROOT.rglob('*') if p.is_file() and p.name!='MANIFEST_SHA256.txt')
    if len(manifest)!=expected_manifest_entries: errors.append('manifest entry count mismatch')
    report={'state':'verified' if not errors else 'failed','actual_total_files':sum(1 for p in ROOT.rglob('*') if p.is_file()),'inventory_files':len(actual),'manifest_entries':len(manifest),'errors':errors}
    print(json.dumps(report,indent=2))
    return 0 if not errors else 1
if __name__=='__main__': raise SystemExit(main())
