#!/usr/bin/env bash
set -euo pipefail
DRY=no;FORCE=no;TARGET="";for a in "$@";do case "$a" in --dry-run)DRY=yes;;--force)FORCE=yes;;*)TARGET="$a";;esac;done
[ -n "$TARGET" ]||{ echo 'Usage: install-zeus [--dry-run] [--force] /path/to/Arq' >&2;exit 2;};SRC="$(cd "$(dirname "$0")/.."&&pwd)";TARGET="$(cd "$TARGET"&&pwd)";STAMP="$(date -u +%Y%m%dT%H%M%SZ)";BACKUP="$TARGET/.zeus/backups/$STAMP";MANIFEST="$TARGET/.zeus/install-manifest.jsonl";mapfile -t FILES < <(cd "$SRC"&&find .zeus .claude .cursor .agents .github scripts docs examples -type f ! -path '.zeus/cache/*'|sort);FILES+=(AGENTS.md CLAUDE-ZEUS-SNIPPET.md)
if [ "$DRY" = yes ];then printf '%s\n' "${FILES[@]}";exit 0;fi;mkdir -p "$BACKUP" "$(dirname "$MANIFEST")";:>"$MANIFEST"
for rel in "${FILES[@]}";do src="$SRC/$rel";dst="$TARGET/$rel";[ -f "$src" ]||continue;if [ -e "$dst" ];then mkdir -p "$BACKUP/$(dirname "$rel")";cp -p "$dst" "$BACKUP/$rel";case "$rel" in AGENTS.md|.github/copilot-instructions.md|.claude/settings.example.json) if [ "$FORCE" != yes ];then echo "Preserved $rel; merge manually.";continue;fi;;esac;fi;mkdir -p "$(dirname "$dst")";cp -p "$src" "$dst";printf '{"path":"%s"}\n' "$rel">>"$MANIFEST";done
(cd "$TARGET"&&node scripts/zeus-verify.mjs&&node scripts/zeus-index.mjs >/dev/null);echo "Zeus 4 installed. Backup: $BACKUP"
