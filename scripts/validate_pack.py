#!/usr/bin/env python3
from pathlib import Path
import csv,json,sys
root=Path(__file__).resolve().parents[1]
errors=[]
text_suffixes={".md",".json",".csv",".ebnf",".arq",".yml",".yaml",".sql",".ts",".tsx",".css",".html",".js",".svg"}
excluded_dirs={"node_modules",".git",".turbo",".vite","dist","build","coverage"}
for p in root.rglob("*"):
    if excluded_dirs & set(p.relative_to(root).parts):
        continue
    if not p.is_file():
        continue
    if p.suffix in text_suffixes:
        try:
            t=p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"Invalid UTF-8: {p.relative_to(root)}")
            continue
        if chr(0x2014) in t or chr(0x2013) in t:
            errors.append(f"Disallowed dash punctuation: {p.relative_to(root)}")
    if p.suffix==".json":
        try:
            json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"Invalid JSON {p.relative_to(root)}: {exc}")
    if p.suffix==".csv":
        try:
            list(csv.reader(p.open(encoding="utf-8")))
        except Exception as exc:
            errors.append(f"Invalid CSV {p.relative_to(root)}: {exc}")
required=["README.md","START-HERE.md","ALL-CONTENTS.md","docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md","docs/pages/ROUTE-MAP.json","docs/components/COMPONENT-MAP.json","api/openapi.yaml","database/schema.sql","prototype/index.html","quality/ANTICIPATED-BUG-CATALOG.json","quality/QA-TEST-CASES.json","validation/UNRESOLVED-VALIDATION-REGISTER.csv","backlog/issues.json"]
for rel in required:
    if not (root/rel).exists():
        errors.append(f"Missing required file: {rel}")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print("Arq all-in-one pack validation passed.")
