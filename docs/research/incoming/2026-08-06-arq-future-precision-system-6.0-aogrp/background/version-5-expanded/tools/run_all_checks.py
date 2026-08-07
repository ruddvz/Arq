from __future__ import annotations
import json, os, sqlite3, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run(cmd):
    env=os.environ.copy(); env['PYTHONDONTWRITEBYTECODE']='1'; env['PYTHONPATH']=str(ROOT/'reference')
    p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,env=env)
    return {'command':' '.join(map(str,cmd)),'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr}

def main():
    results=[]
    results.append(run([sys.executable,'-m','unittest','discover','-s','reference/tests','-v']))
    con=sqlite3.connect(':memory:')
    try:
        con.executescript((ROOT/'sql/ARQ_V5_CANDIDATE_LOGICAL_SCHEMA.sql').read_text(encoding='utf-8'))
        sql='passed'
    finally: con.close()
    from jsonschema import Draft202012Validator
    schemas=sorted((ROOT/'schemas').glob('*.json'))
    for p in schemas: Draft202012Validator.check_schema(json.loads(p.read_text(encoding='utf-8')))
    expected=json.loads((ROOT/'fixtures/EXPECTED_VERDICTS.json').read_text(encoding='utf-8'))
    standards=json.loads((ROOT/'current-state/STANDARDS_SNAPSHOT.json').read_text(encoding='utf-8'))
    mcp=[r for r in standards['records'] if r['area']=='MCP']
    report={
      'state':'verified' if all(x['exit_code']==0 for x in results) else 'failed',
      'tests':results,
      'sql_parse':sql,
      'schema_count':len(schemas),
      'schema_meta_validation':'passed',
      'fixture_count':len(expected),
      'fixture_expectations_present':'passed',
      'mcp_snapshot':mcp[0]['current'] if mcp else None,
      'python':sys.version,
      'sqlite_runtime':sqlite3.sqlite_version,
      'note':'Package runtime SQLite is not the current upstream browser or production SQLite build.'
    }
    print(json.dumps(report,indent=2))
    return 0 if report['state']=='verified' else 1
if __name__=='__main__': raise SystemExit(main())
