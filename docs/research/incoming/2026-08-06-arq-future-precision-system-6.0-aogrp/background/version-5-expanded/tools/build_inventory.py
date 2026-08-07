from __future__ import annotations
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def main():
    excluded={'PACKAGE_INVENTORY.json','MANIFEST_SHA256.txt'}
    files=[]
    for p in sorted(ROOT.rglob('*')):
        if p.is_file() and p.name not in excluded:
            files.append({'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
    stats={
      'file_count_excluding_inventory_and_manifest':len(files),
      'actual_total_file_count':len(files)+2,
      'markdown_count':sum(x['path'].endswith('.md') for x in files),
      'json_count':sum(x['path'].endswith('.json') for x in files)+1,
      'schema_count':sum(x['path'].startswith('schemas/') and x['path'].endswith('.json') for x in files),
      'arq_fixture_count':sum(x['path'].endswith('.arq') for x in files),
      'python_source_count':sum(x['path'].endswith('.py') for x in files),
      'markdown_words':sum(len((ROOT/x['path']).read_text(encoding='utf-8').split()) for x in files if x['path'].endswith('.md')),
      'total_bytes_excluding_inventory_and_manifest':sum(x['bytes'] for x in files)
    }
    (ROOT/'PACKAGE_INVENTORY.json').write_text(json.dumps({'package':'ARQ_FUTURE_PRECISION_FILE_SYSTEM_5.0_2026-08-06','generated_from_final_tree':True,'stats':stats,'files':files},indent=2)+'\n',encoding='utf-8')
    manifest=[]
    for p in sorted(ROOT.rglob('*')):
        if p.is_file() and p.name!='MANIFEST_SHA256.txt':
            manifest.append(f"{sha(p)}  {p.relative_to(ROOT).as_posix()}")
    (ROOT/'MANIFEST_SHA256.txt').write_text('\n'.join(manifest)+'\n',encoding='utf-8')
    print(json.dumps(stats,indent=2))
if __name__=='__main__': main()
