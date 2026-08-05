#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")"&&pwd)";H="$DIR/zeus-hook.sh";L="$DIR/zeus-prompt-lint.mjs";run(){ printf '{"prompt":%s}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")"|"$H";};f=0;[ -z "$(run ok)" ]||f=$((f+1));run 'Fix centre snap'|grep -q 'Zeus 5 Compact Contract'||f=$((f+1));run 'Fix centre snap'|grep -q 'Zeus 5 Execution Prompt'||f=$((f+1));ZEUS_HOOK_PROMPT=0 run 'Fix centre snap'|grep -q 'Execution Prompt'&&f=$((f+1));[ -z "$(run '/zeus-audit plan')" ]||f=$((f+1))
# Regression: the generated execution prompt must pass its own delegated-prompt lint
# on tasks that route no independent reviewer, not only on the one input (a
# reviewer-routing task) that happened to satisfy the lint's role check by accident.
for t in 'add a button to the toolbar' 'fix a typo in the readme' 'update the changelog'; do
  node "$DIR/zeus-prompt.mjs" --task "$t" | node "$L" >/dev/null || f=$((f+1))
done
[ "$f" -eq 0 ]||exit 1;echo 'Zeus 5 hook tests passed.'
