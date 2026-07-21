#!/usr/bin/env python3
from pathlib import Path
import json
import shlex

root = Path(__file__).resolve().parents[1]
issues = json.loads((root / "backlog/issues.json").read_text(encoding="utf-8"))

print("# Review before running. Requires authenticated GitHub CLI.")
for issue in issues:
    body_path = root / issue["file"]
    labels = issue["labels"].split(";")
    label_args = " ".join(f"--label {shlex.quote(label)}" for label in labels)
    print(
        "gh issue create "
        f"--title {shlex.quote(issue['title'])} "
        f"--body-file {shlex.quote(str(body_path))} "
        f"{label_args}"
    )
