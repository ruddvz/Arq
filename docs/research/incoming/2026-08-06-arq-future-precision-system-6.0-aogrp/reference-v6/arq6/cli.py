from __future__ import annotations
import argparse, json, sys
from pathlib import Path
if __package__ in (None,""):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1])); from arq6.format import open_manifest,deep_validate
else: from .format import open_manifest,deep_validate

def main():
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest="cmd",required=True)
    p=sub.add_parser("inspect"); p.add_argument("file"); p.add_argument("--deep",action="store_true")
    a=ap.parse_args(); r=deep_validate(a.file) if a.deep else open_manifest(a.file)
    print(json.dumps({"mode":r["mode"],"root_slot":r["root_slot"],"generation":r["manifest"]["generation"],"semantic_root":r["manifest"]["semantic_root"],"head_revision":r["manifest"]["head_revision"],"objects":len(r["manifest"]["object_ids"]),"missing_required":r["missing_required"]},indent=2))
if __name__=="__main__": main()
