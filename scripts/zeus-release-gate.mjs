#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2); const localOnly=args.includes('--local-only'); const noRun=args.includes('--no-run'); const requireClean=args.includes('--require-clean');
const cwd=process.cwd(); const scriptDir=dirname(fileURLToPath(import.meta.url)); const checks=[]; const run=(name,cmd,a=[])=>{if(noRun){checks.push({name,status:'unknown',evidence:'--no-run'});return;}const r=spawnSync(cmd,a,{cwd,encoding:'utf8',stdio:'pipe',maxBuffer:20*1024*1024});checks.push({name,status:r.status===0?'pass':r.status===3?'unknown':'fail',evidence:((r.stdout??'')+'\n'+(r.stderr??'')).trim().slice(-5000)});};
run('repository preflight',process.execPath,[join(scriptDir,'zeus-preflight.mjs'),...(requireClean?[]:['--allow-dirty'])]);
run('architecture policy lint',process.execPath,[join(scriptDir,'zeus-architecture-lint.mjs'),cwd]);
run('security lint',process.execPath,[join(scriptDir,'zeus-security-lint.mjs'),cwd]);
let pkg={}; if(existsSync(join(cwd,'package.json')))try{pkg=JSON.parse(readFileSync(join(cwd,'package.json'),'utf8'))}catch{}
const pm=existsSync(join(cwd,'pnpm-lock.yaml'))?'pnpm':existsSync(join(cwd,'yarn.lock'))?'yarn':'npm';
for(const name of ['format:check','lint','typecheck','test','build']) if(pkg.scripts?.[name]) run(`package script ${name}`,pm,pm==='npm'?['run',name]:[name]);
if(!localOnly) run('GitHub PR/check status',process.execPath,[join(scriptDir,'zeus-github-status.mjs')]);
const fail=checks.some(c=>c.status==='fail'); const unknown=checks.some(c=>c.status==='unknown'); const report={status:fail?'failed':unknown?'partial':'green',localOnly,checks}; console.log(JSON.stringify(report,null,2)); process.exit(fail?1:unknown?3:0);
