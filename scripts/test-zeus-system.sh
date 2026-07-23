#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.."&&pwd)";TMP="$(mktemp -d)";trap 'rm -rf "$TMP"' EXIT;cd "$ROOT"
node scripts/zeus-verify.mjs;bash scripts/test-zeus-hook.sh
node scripts/zeus.mjs compile --task 'Fix a README typo' --format json >"$TMP/fast.json";node -e "const x=require('$TMP/fast.json');if(x.tier!=='fast'||x.modules.length>1||JSON.stringify(x).length>4000)process.exit(1)"
node scripts/zeus.mjs compile --task 'Fix .arq migration recovery, open a PR, merge and deploy to production' --format json >"$TMP/deep.json";node -e "const x=require('$TMP/deep.json');if(x.tier!=='deep'||x.deliveryStop!=='production-verified'||!x.modules.includes('arqfs'))process.exit(1)"
node scripts/zeus.mjs route --task 'Build pixel-perfect accessible tablet editor' >"$TMP/route.json";node -e "const x=require('$TMP/route.json');if(!x.modules.some(m=>m.id==='ui-visual'))process.exit(1)"
mkdir -p "$TMP/repo/src" "$TMP/repo/docs";cd "$TMP/repo";git init -q;git config user.email zeus@example.invalid;git config user.name Zeus;cat >package.json <<'JSON'
{"name":"fixture","scripts":{"format:check":"node -e \"process.exit(0)\"","typecheck":"node -e \"process.exit(0)\"","test":"node -e \"process.exit(0)\"","build":"node -e \"process.exit(0)\""}}
JSON
printf '# Fixture\n' >README.md;printf 'export const wall=1;\n' >src/wall.ts;git add .;git commit -qm init;git checkout -qb agent/fixture
node "$ROOT/scripts/zeus-index.mjs" --root "$TMP/repo" >"$TMP/index1.json";node "$ROOT/scripts/zeus-index.mjs" --root "$TMP/repo" >"$TMP/index2.json";node -e "const x=require('$TMP/index2.json');if(x.status!=='hit')process.exit(1)"
node "$ROOT/scripts/zeus-context.mjs" --root "$TMP/repo" --query 'wall source' >"$TMP/context.json";node -e "const x=require('$TMP/context.json');if(!x.results.length||x.results.length>4)process.exit(1)"
printf '// change\n' >>src/wall.ts;node "$ROOT/scripts/zeus-impact.mjs" --root "$TMP/repo" --task 'fix wall geometry' >"$TMP/impact.json";node -e "const x=require('$TMP/impact.json');if(!x.modules.includes('geometry'))process.exit(1)"
node "$ROOT/scripts/zeus-check.mjs" --root "$TMP/repo" --tier fast --task 'fix wall geometry' >"$TMP/check.json";node -e "const x=require('$TMP/check.json');if(x.status!=='green')process.exit(1)"
node "$ROOT/scripts/zeus-benchmark.mjs" --root "$TMP/repo" --iterations 200 >"$TMP/bench.json" || test $? -eq 3
node -e "const x=require('$TMP/bench.json');if(x.fastContractJsonChars>4000||x.inProcessCompileAndRouteMs.p95>20)process.exit(1)"
cd "$ROOT";node scripts/zeus-architecture-lint.mjs quality/architecture-clean;if node scripts/zeus-architecture-lint.mjs quality/architecture-bad >/dev/null 2>&1;then exit 1;fi;node scripts/zeus-security-lint.mjs quality/fixtures/security-clean;if node scripts/zeus-security-lint.mjs quality/fixtures/security-bad >/dev/null 2>&1;then exit 1;fi
mkdir -p "$TMP/target/docs";cp "$TMP/repo/package.json" "$TMP/target/package.json";printf 'human\n' >"$TMP/target/AGENTS.md";bash scripts/install-zeus.sh "$TMP/target" >/dev/null;grep -q human "$TMP/target/AGENTS.md";bash "$TMP/target/scripts/uninstall-zeus.sh" "$TMP/target" >/dev/null;[ ! -f "$TMP/target/.zeus/FAST-KERNEL.md" ];echo 'Zeus 4 full system tests passed.'
