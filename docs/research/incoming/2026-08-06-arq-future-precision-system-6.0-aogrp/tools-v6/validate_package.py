from __future__ import annotations
from pathlib import Path
import json,hashlib,sys,subprocess,yaml
import jsonschema
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'reference-v6'))
from arq6.format import open_manifest,deep_validate,ArqFormatError

def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1<<20),b''): h.update(b)
 return h.hexdigest()

def main(check_generated=True):
 errors=[]; notes=[]
 for p in ROOT.rglob('*'):
  if p.is_file() and (p.suffix=='.pyc' or '__pycache__' in p.parts): errors.append(f'generated cache: {p.relative_to(ROOT)}')
  if p.is_file() and p.suffix in {'.md','.py','.json','.yaml','.yml','.csv','.sql'}:
   try: t=p.read_text(encoding='utf-8')
   except Exception as e: errors.append(f'utf8: {p}: {e}'); continue
   if '\u2014' in t: errors.append(f'em dash: {p.relative_to(ROOT)}')
 for p in (ROOT/'schemas-v6').glob('*.json'):
  try: jsonschema.Draft202012Validator.check_schema(json.loads(p.read_text()))
  except Exception as e: errors.append(f'schema {p.name}: {e}')
 for p in (ROOT/'handoff-v6').glob('*.yaml'):
  try: yaml.safe_load(p.read_text())
  except Exception as e: errors.append(f'yaml {p.name}: {e}')
 exp=json.loads((ROOT/'fixtures-v6/EXPECTED_VERDICTS.json').read_text())
 for name,e in exp.items():
  p=ROOT/'fixtures-v6'/name
  try:
   if e['verdict']=='reject':
    try: open_manifest(p); errors.append(f'{name}: expected reject')
    except Exception: pass
   elif e['verdict']=='reject-deep':
    try: deep_validate(p); errors.append(f'{name}: expected deep reject')
    except Exception: pass
   else:
    r=deep_validate(p)
    if r['manifest']['generation']!=e['generation']: errors.append(f'{name}: generation')
    if r['mode']!=e['mode']: errors.append(f'{name}: mode')
  except Exception as x: errors.append(f'{name}: {x}')
 if check_generated and (ROOT/'MANIFEST_SHA256.txt').exists():
  for line in (ROOT/'MANIFEST_SHA256.txt').read_text().splitlines():
   if not line.strip(): continue
   hv,rel=line.split('  ',1); p=ROOT/rel
   if not p.exists() or sha(p)!=hv: errors.append(f'manifest mismatch: {rel}')
 if check_generated and (ROOT/'PACKAGE_INVENTORY.json').exists():
  inv=json.loads((ROOT/'PACKAGE_INVENTORY.json').read_text())
  actual=sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name not in {'PACKAGE_INVENTORY.json','MANIFEST_SHA256.txt'})
  listed=sorted(x['path'] for x in inv['files'])
  if actual!=listed: errors.append('inventory paths mismatch')
 print(json.dumps({'ok':not errors,'errors':errors,'notes':notes},indent=2))
 return 0 if not errors else 1
if __name__=='__main__': raise SystemExit(main())
