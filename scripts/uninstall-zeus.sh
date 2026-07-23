#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-}";[ -n "$TARGET" ]||{ echo 'Usage: uninstall-zeus /path/to/Arq' >&2;exit 2;};TARGET="$(cd "$TARGET"&&pwd)";M="$TARGET/.zeus/install-manifest.jsonl";[ -f "$M" ]||{ echo 'No install manifest.' >&2;exit 1;};python3 - "$TARGET" "$M" <<'PY2'
import json,pathlib,sys
r=pathlib.Path(sys.argv[1]);m=pathlib.Path(sys.argv[2])
for line in m.read_text().splitlines():
 if line.strip():
  p=r/json.loads(line)['path']
  if p.is_file():p.unlink()
PY2
echo 'Removed Zeus-owned files; backups and runtime cache preserved.'
