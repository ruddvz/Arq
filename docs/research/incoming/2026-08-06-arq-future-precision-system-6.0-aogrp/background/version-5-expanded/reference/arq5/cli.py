from __future__ import annotations
import argparse,json
from pathlib import Path
from .container import preflight,validate,create_demo,publish,ArqFileError

def main(argv=None):
    p=argparse.ArgumentParser(prog='arq5-demo')
    sub=p.add_subparsers(dest='cmd',required=True)
    for name in ['preflight','validate']:
        sp=sub.add_parser(name); sp.add_argument('path')
    sp=sub.add_parser('create-demo'); sp.add_argument('path'); sp.add_argument('--schema',required=True)
    sp=sub.add_parser('publish'); sp.add_argument('source'); sp.add_argument('destination'); sp.add_argument('--inject-failure',action='store_true')
    a=p.parse_args(argv)
    try:
        if a.cmd=='preflight': result=preflight(Path(a.path))
        elif a.cmd=='validate': result=validate(Path(a.path))
        elif a.cmd=='create-demo': result=create_demo(Path(a.path),Path(a.schema))
        else: result=publish(Path(a.source),Path(a.destination),fail_before_promote=a.inject_failure)
        print(json.dumps(result,indent=2)); return 0
    except ArqFileError as e:
        print(json.dumps({'code':e.code,'message':str(e)},indent=2)); return 2
if __name__=='__main__': raise SystemExit(main())
