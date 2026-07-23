#!/usr/bin/env bash
set -u
INPUT="$(cat)"; PROMPT=""
if command -v python3 >/dev/null 2>&1; then PROMPT="$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
 o=json.load(sys.stdin);print(next((o[k] for k in ("prompt","message","text","content") if isinstance(o.get(k),str)),""))
except: print("")' 2>/dev/null)"; fi
NORM="$(printf '%s' "$PROMPT"|tr '[:upper:]' '[:lower:]'|tr -s '[:space:]' ' '|sed -e 's/^ *//' -e 's/ *$//' -e 's/[.!?,]*$//')"
case "$PROMPT" in *"<task-notification>"*|*"<github-webhook-activity>"*|*"SYSTEM NOTIFICATION - NOT USER INPUT"*) exit 0;; esac
case "$NORM" in yes|ok|okay|sure|great|perfect|done|thanks|"thank you"|continue|proceed|next|lgtm) exit 0;; esac
case "$NORM" in /zeus-audit*|/zeus-design*|/zeus-release*|/zeus-incident*|/zeus-handoff*) exit 0;; esac
printf '%s\n' '[ZEUS 4 INTERNAL] Load FAST-KERNEL only; route modules; use indexed context; execute; run adaptive checks; report verified status.'
