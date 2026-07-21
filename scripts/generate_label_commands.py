#!/usr/bin/env python3
from pathlib import Path
import json
import shlex

root = Path(__file__).resolve().parents[1]
labels = json.loads((root / ".github/labels.json").read_text(encoding="utf-8"))

print("# Review before running. Requires authenticated GitHub CLI.")
for label in labels:
    print(
        "gh label create "
        f"{shlex.quote(label['name'])} "
        f"--description {shlex.quote(label['description'])} "
        "--force"
    )
