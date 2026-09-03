#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.."&&pwd)";TMP="$(mktemp -d)";trap 'rm -rf "$TMP"' EXIT;cd "$ROOT"
node scripts/zeus-verify.mjs;bash scripts/test-zeus-hook.sh
node scripts/zeus-validate.mjs
node scripts/zeus-classification-test.mjs
node scripts/zeus-guard-test.mjs
node scripts/zeus-drift-guard.mjs
node scripts/zeus.mjs evidence init --root "$TMP" --task 'system test' >/dev/null
node scripts/zeus.mjs evidence add --root "$TMP" --claim 'checks ran' --state verified --command 'true' --exit 0 >/dev/null
node scripts/zeus.mjs evidence report --root "$TMP" >/dev/null
node scripts/zeus.mjs evidence add --root "$TMP" --claim 'unseen surface' --state not-inspected --reason 'no capability check' >/dev/null
if node scripts/zeus.mjs evidence report --root "$TMP" >/dev/null;then echo 'evidence ledger graded an uninspected claim as green' >&2;exit 1;fi
node scripts/zeus.mjs compile --task 'Fix a README typo' --format json >"$TMP/fast.json";node -e "const x=require('$TMP/fast.json');if(x.tier!=='fast'||x.modules.length>1||JSON.stringify(x).length>4000)process.exit(1)"
node scripts/zeus.mjs compile --task 'Fix .arq migration recovery, open a PR, merge and deploy to production' --format json >"$TMP/deep.json";node -e "const x=require('$TMP/deep.json');if(x.tier!=='deep'||x.deliveryStop!=='production-verified'||!x.modules.includes('arqfs'))process.exit(1)"
node scripts/zeus.mjs route --task 'Build pixel-perfect accessible tablet editor' >"$TMP/route.json";node -e "const x=require('$TMP/route.json');if(!x.modules.some(m=>m.id==='ui-visual'))process.exit(1)"
mkdir -p "$TMP/repo/src" "$TMP/repo/docs";cd "$TMP/repo";git init -q;git config user.email zeus@example.invalid;git config user.name Zeus;cat >package.json <<'JSON'
{"name":"fixture","scripts":{"format:check":"node -e \"process.exit(0)\"","typecheck":"node -e \"process.exit(0)\"","test":"node -e \"process.exit(0)\"","build":"node -e \"process.exit(0)\""}}
JSON
printf '# Fixture\n' >README.md;printf 'export const wall=1;\n' >src/wall.ts;for i in $(seq 1 80);do printf '// filler line %03d abcdefghijklmnopqrstuvwxyz\n' "$i" >>src/wall.ts;done;printf '// precisiontarget wall snapping evidence lives here\n' >>src/wall.ts;printf '# Legacy ledger\nlegacytoken implementation ledger historical evidence\n' >docs/ARQ_V13_IMPLEMENTATION_LEDGER.md;git add .;git commit -qm init;git checkout -qb agent/fixture
node "$ROOT/scripts/zeus-index.mjs" --root "$TMP/repo" >"$TMP/index1.json";node "$ROOT/scripts/zeus-index.mjs" --root "$TMP/repo" >"$TMP/index2.json";node -e "const x=require('$TMP/index2.json');if(x.status!=='hit')process.exit(1)"
mkdir -p "$TMP/repo/.zeus/runs";printf 'stale log\n' >"$TMP/repo/.zeus/runs/run.log";node "$ROOT/scripts/zeus-index.mjs" --root "$TMP/repo" --force >/dev/null;node -e "const fs=require('fs');const idx=JSON.parse(fs.readFileSync('$TMP/repo/.zeus/cache/project-index.json','utf8'));if(idx.files.some(f=>f.path.startsWith('.zeus/cache/')||f.path.startsWith('.zeus/runs/')))process.exit(1)"
node "$ROOT/scripts/zeus-context.mjs" --root "$TMP/repo" --query 'wall source' >"$TMP/context.json";node -e "const x=require('$TMP/context.json');if(!x.results.length||x.results.length>3||x.budget.contextChars!==4000)process.exit(1)"
node "$ROOT/scripts/zeus-context.mjs" --root "$TMP/repo" --query 'wall precisiontarget' --snippets >"$TMP/context-snippet.json";node -e "const x=require('$TMP/context-snippet.json');const r=x.results.find(r=>r.path==='src/wall.ts');if(!r||!r.snippet.includes('precisiontarget')||r.snippetStart<=0||x.usedContextChars>x.budget.contextChars)process.exit(1)"
node "$ROOT/scripts/zeus-context.mjs" --root "$TMP/repo" --query 'legacytoken implementation ledger' --snippets >"$TMP/context-cold.json";node -e "const x=require('$TMP/context-cold.json');if(x.results.some(r=>r.path.includes('IMPLEMENTATION_LEDGER'))||x.coldSourcesExcluded<1)process.exit(1)"
node "$ROOT/scripts/zeus-context.mjs" --root "$TMP/repo" --query 'legacytoken implementation ledger' --snippets --include-cold >"$TMP/context-cold-explicit.json";node -e "const x=require('$TMP/context-cold-explicit.json');if(!x.results.some(r=>r.path.includes('IMPLEMENTATION_LEDGER')))process.exit(1)"
printf '// change\n' >>src/wall.ts;node "$ROOT/scripts/zeus-impact.mjs" --root "$TMP/repo" --task 'fix wall geometry' >"$TMP/impact.json";node -e "const x=require('$TMP/impact.json');if(!x.modules.includes('geometry'))process.exit(1)"
node "$ROOT/scripts/zeus-check.mjs" --root "$TMP/repo" --tier fast --task 'fix wall geometry' >"$TMP/check.json";node -e "const x=require('$TMP/check.json');if(x.status!=='green')process.exit(1)"
node "$ROOT/scripts/zeus-benchmark.mjs" --root "$TMP/repo" --iterations 200 >"$TMP/bench.json" || test $? -eq 3
node -e "const x=require('$TMP/bench.json');if(x.fastContractJsonChars>4000||x.inProcessCompileAndRouteMs.p95>20)process.exit(1)"
cd "$ROOT";node scripts/zeus-architecture-lint.mjs quality/architecture-clean;if node scripts/zeus-architecture-lint.mjs quality/architecture-bad >/dev/null 2>&1;then exit 1;fi;node scripts/zeus-security-lint.mjs quality/fixtures/security-clean;if node scripts/zeus-security-lint.mjs quality/fixtures/security-bad >/dev/null 2>&1;then exit 1;fi
mkdir -p "$TMP/target/docs";cp "$TMP/repo/package.json" "$TMP/target/package.json";printf 'human\n' >"$TMP/target/AGENTS.md";bash scripts/install-zeus.sh "$TMP/target" >/dev/null;grep -q human "$TMP/target/AGENTS.md";bash "$TMP/target/scripts/uninstall-zeus.sh" "$TMP/target" >/dev/null;[ ! -f "$TMP/target/.zeus/FAST-KERNEL.md" ];echo 'Zeus 5 full system tests passed.'
