#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2); const i=args.indexOf('--run'); const runId=i>=0?args[i+1]:null;
if(!runId){console.error('Usage: zeus-ci-triage --run <workflow-run-id>');process.exit(2);}
const gh=(a)=>spawnSync('gh',a,{encoding:'utf8',maxBuffer:20*1024*1024});
if(gh(['--version']).status!==0){console.error('gh CLI unavailable');process.exit(3);}
const view=gh(['run','view',runId,'--json','databaseId,workflowName,status,conclusion,headSha,url,jobs']);
if(view.status!==0){process.stderr.write(view.stderr);process.exit(1);} const data=JSON.parse(view.stdout);
const logs=gh(['run','view',runId,'--log-failed']); const raw=(logs.stdout??'')+'\n'+(logs.stderr??''); const text=raw.replace(/gh[pousr]_[A-Za-z0-9]{20,}/g,'[REDACTED_GITHUB_TOKEN]').replace(/(authorization:\s*(?:bearer|basic)\s+)[^\s]+/ig,'$1[REDACTED]').replace(/((?:secret|token|password|api[_-]?key)\s*[=:]\s*)[^\s]+/ig,'$1[REDACTED]');
const patterns=[
 ['permissions-or-secrets',/resource not accessible|permission denied|bad credentials|secret.*not found|403/i],
 ['dependency-or-supply-chain',/npm audit|pnpm.*ERR|lockfile|integrity checksum|vulnerab|license/i],
 ['timeout-or-resource',/timed out|out of memory|heap|no space left|quota/i],
 ['visual-regression',/visual regression|screenshot|pixel.*diff|baseline/i],
 ['test-or-code',/test failed|assertion|type error|typescript|lint error|build failed/i],
 ['infrastructure-or-flaky',/runner lost|service unavailable|connection reset|502|503|504/i]
];
const classifications=patterns.filter(([,r])=>r.test(text)).map(([n])=>n);
const failedJobs=(data.jobs??[]).filter(j=>j.conclusion&&j.conclusion!=='success').map(j=>({name:j.name,conclusion:j.conclusion,failedSteps:(j.steps??[]).filter(s=>s.conclusion&&s.conclusion!=='success'&&s.conclusion!=='skipped').map(s=>s.name)}));
console.log(JSON.stringify({run:data,failedJobs,classifications:classifications.length?classifications:['unclassified-manual-review-required'],rerunAdvice:classifications.includes('infrastructure-or-flaky')?'One evidence-based rerun may be reasonable':'Fix root cause before rerun',failedLogExcerpt:text.slice(-12000)},null,2));
