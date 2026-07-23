#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2); const allowDirty=args.includes('--allow-dirty'); const readOnly=args.includes('--read-only');
const run=(...a)=>spawnSync('git',a,{encoding:'utf8'}); const top=run('rev-parse','--show-toplevel');
if(top.status!==0){console.error('Not inside a git repository.');process.exit(2);} const root=top.stdout.trim();
const g=(...a)=>spawnSync('git',['-C',root,...a],{encoding:'utf8'});
const branch=g('branch','--show-current').stdout.trim(); const head=g('rev-parse','HEAD').stdout.trim(); const status=g('status','--porcelain').stdout.trim().split('\n').filter(Boolean);
let defaultBranch=null; const remote=g('symbolic-ref','refs/remotes/origin/HEAD','--short'); if(remote.status===0) defaultBranch=remote.stdout.trim().replace(/^origin\//,''); if(!defaultBranch){const gh=spawnSync('gh',['repo','view','--json','defaultBranchRef'],{encoding:'utf8'});if(gh.status===0){try{defaultBranch=JSON.parse(gh.stdout).defaultBranchRef?.name??null}catch{}}} if(!defaultBranch){const show=g('remote','show','origin');const m=show.stdout.match(/HEAD branch:\s*(\S+)/);if(m)defaultBranch=m[1];}
const failures=[]; const warnings=[];
if(!branch) failures.push('Detached HEAD');
if(status.length&&!allowDirty) failures.push(`Worktree has ${status.length} changed/untracked path(s)`);
if(!readOnly&&defaultBranch&&branch===defaultBranch) failures.push(`Current branch is default branch ${defaultBranch}`);
if(!defaultBranch) warnings.push('Default branch could not be discovered locally');
const report={root,branch,defaultBranch,head,dirtyPaths:status,readOnly,failures,warnings,passed:failures.length===0};
console.log(JSON.stringify(report,null,2)); process.exit(failures.length?1:0);
