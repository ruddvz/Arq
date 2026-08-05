#!/usr/bin/env bash
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="$(cat)"; PROMPT=""
if command -v python3 >/dev/null 2>&1; then PROMPT="$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
 o=json.load(sys.stdin);print(next((o[k] for k in ("prompt","message","text","content") if isinstance(o.get(k),str)),""))
except: print("")' 2>/dev/null)"; fi
NORM="$(printf '%s' "$PROMPT"|tr '[:upper:]' '[:lower:]'|tr -s '[:space:]' ' '|sed -e 's/^ *//' -e 's/ *$//' -e 's/[.!?,]*$//')"
case "$PROMPT" in *"<task-notification>"*|*"<github-webhook-activity>"*|*"SYSTEM NOTIFICATION - NOT USER INPUT"*) exit 0;; esac
case "$NORM" in yes|ok|okay|sure|great|perfect|done|thanks|"thank you"|continue|proceed|next|lgtm) exit 0;; esac
case "$NORM" in /zeus-audit*|/zeus-design*|/zeus-release*|/zeus-incident*|/zeus-handoff*|/zeus-team*) exit 0;; esac
# ZEUS_HOOK_PROMPT=0 keeps the hook to the compact contract alone.
if [ "${ZEUS_HOOK_PROMPT:-1}" = "0" ]; then
  CONTRACT="$(node "$DIR/zeus-fast-compile.mjs" --task "$PROMPT" 2>/dev/null)"
else
  CONTRACT="$(node "$DIR/zeus-prompt.mjs" --task "$PROMPT" --with-contract 2>/dev/null)"
fi
if [ -n "$CONTRACT" ]; then
  printf 'Zeus 5 routed this prompt:\n%s\n' "$CONTRACT"
else
  printf '%s\n' '[ZEUS 5 INTERNAL] Load FAST-KERNEL only; route modules; use indexed context; execute; run adaptive checks; report verified status.'
fi
