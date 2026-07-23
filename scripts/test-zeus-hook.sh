#!/usr/bin/env bash
set -euo pipefail
H="$(cd "$(dirname "$0")"&&pwd)/zeus-hook.sh";run(){ printf '{"prompt":%s}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")"|"$H";};f=0;[ -z "$(run ok)" ]||f=$((f+1));run 'Fix centre snap'|grep -q 'ZEUS 4 INTERNAL'||f=$((f+1));[ -z "$(run '/zeus-audit plan')" ]||f=$((f+1));[ "$f" -eq 0 ]||exit 1;echo 'Zeus 4 hook tests passed.'
