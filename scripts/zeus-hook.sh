#!/usr/bin/env bash
# Zeus 5 UserPromptSubmit hook.
#
# Warn-only by design: every path exits 0, so a hook failure can never block the
# operator. It prints the compiled compact contract for actionable prompts and,
# underneath it, the continual harness block: the supplemental state Zeus has
# actually learned. Before the harness existed, .zeus/eval-log.jsonl was written
# by scripts/zeus-eval-record.mjs and read by nothing, so no lesson Zeus recorded
# ever reached a later turn.
set -u
# A consumer is allowed to stop reading early (grep -q, head). Without this the
# resulting SIGPIPE kills the hook mid-write and reports 141, turning a warn-only
# hook into a failing one under `set -o pipefail`. Ignoring PIPE lets the write
# fail harmlessly and every path still reach exit 0.
trap '' PIPE
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="$(cat)"; PROMPT=""
if command -v python3 >/dev/null 2>&1; then PROMPT="$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
 o=json.load(sys.stdin);print(next((o[k] for k in ("prompt","message","text","content") if isinstance(o.get(k),str)),""))
except: print("")' 2>/dev/null)"; fi
NORM="$(printf '%s' "$PROMPT"|tr '[:upper:]' '[:lower:]'|tr -s '[:space:]' ' '|sed -e 's/^ *//' -e 's/ *$//' -e 's/[.!?,]*$//')"
case "$PROMPT" in *"<task-notification>"*|*"<github-webhook-activity>"*|*"SYSTEM NOTIFICATION - NOT USER INPUT"*) exit 0;; esac
case "$NORM" in yes|ok|okay|sure|great|perfect|done|thanks|"thank you"|continue|proceed|next|lgtm) exit 0;; esac
# Slash commands carry their own contract. Driven off .claude/commands/ by
# scripts/zeus-drift-guard.mjs, which fails when a command file exists that this
# case does not skip: a pinned list stops covering the next command someone adds,
# which is the drift it exists to catch.
case "$NORM" in /zeus-audit*|/zeus-design*|/zeus-release*|/zeus-incident*|/zeus-handoff*|/zeus-refine*) exit 0;; esac
CONTRACT="$(node "$DIR/zeus-fast-compile.mjs" --task "$PROMPT" 2>/dev/null)"
# Computed BEFORE any output is written, deliberately: spawning node after output
# has begun leaves a window in which a consumer that stopped reading early has
# already closed the pipe, and the late write kills the hook with SIGPIPE.
#
# A failure here must never block the turn and must never be silent either.
# zeus-harness-state.mjs throws on a corrupt or malformed store rather than
# substituting an empty one, because erasing learned behaviour silently reads as
# "Zeus had no lessons". `2>/dev/null || true` would throw that signal away: a
# truncated store would produce a normal-looking turn with every lesson gone. The
# error is surfaced in the block instead, and the turn still proceeds.
HARNESS=""
if command -v node >/dev/null 2>&1 && [ -f "$DIR/zeus-harness-state.mjs" ]; then
  HARNESS_ERR="$(mktemp 2>/dev/null || echo "/tmp/zeus-harness-err.$$")"
  if ! HARNESS="$(node "$DIR/zeus-harness-state.mjs" format 2>"$HARNESS_ERR")"; then
    HARNESS="Zeus learned state UNAVAILABLE: the harness store did not load, so no lesson
reaches this turn. Say so rather than assuming there is nothing learned.
Reason: $(head -c 300 "$HARNESS_ERR" 2>/dev/null | tr '\n' ' ')
Fix with: pnpm zeus:harness list"
  fi
  rm -f "$HARNESS_ERR" 2>/dev/null || true
fi
if [ -n "$CONTRACT" ]; then
  MSG="$(printf 'Zeus 5 routed this prompt:\n%s' "$CONTRACT")"
else
  MSG='[ZEUS 5 INTERNAL] Load FAST-KERNEL only; route modules; use indexed context; execute; run adaptive checks; report verified status.'
fi
# Entry text is agent-authored, so it is only ever carried as a variable and
# printed. Bash does not re-scan the result of a variable expansion, so backticks
# and $(...) inside an entry stay literal here; they would execute only if this
# text were eval'd or written into a sourced script. Keep it that way.
[ -n "$HARNESS" ] && MSG="$MSG

$HARNESS"
# One write, so there is no second write left to fail after a consumer that
# stopped reading early has closed the pipe.
printf '%s\n' "$MSG" 2>/dev/null || true
exit 0
