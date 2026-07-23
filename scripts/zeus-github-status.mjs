#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const run = (a) => spawnSync('gh', a, { encoding: 'utf8' });
if (run(['--version']).status !== 0) {
  console.error(
    JSON.stringify(
      {
        status: 'blocked',
        reason: 'gh CLI unavailable; use a GitHub connector or install/authenticate gh',
      },
      null,
      2,
    ),
  );
  process.exit(3);
}
const auth = run(['auth', 'status']);
if (auth.status !== 0) {
  console.error(
    JSON.stringify(
      { status: 'blocked', reason: 'gh CLI is not authenticated', details: auth.stderr.trim() },
      null,
      2,
    ),
  );
  process.exit(3);
}
const repo = run(['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef,url']);
if (repo.status !== 0) {
  process.stderr.write(repo.stderr);
  process.exit(1);
}
const repoData = JSON.parse(repo.stdout);
const pr = run([
  'pr',
  'view',
  '--json',
  'number,title,state,isDraft,headRefName,headRefOid,baseRefName,mergeable,reviewDecision,statusCheckRollup,url',
]);
const allowNoPr = process.argv.includes('--allow-no-pr');
const report = { status: 'ok', repository: repoData, pullRequest: null };
if (pr.status === 0) {
  report.pullRequest = JSON.parse(pr.stdout);
  const checks = report.pullRequest.statusCheckRollup ?? [];
  report.summary = {
    total: checks.length,
    failed: checks.filter((c) =>
      ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(c.conclusion),
    ).length,
    pending: checks.filter(
      (c) =>
        !c.conclusion ||
        ['QUEUED', 'IN_PROGRESS', 'PENDING', 'WAITING', 'REQUESTED'].includes(c.status),
    ).length,
  };
} else {
  report.status = 'partial';
  report.pullRequest = { status: 'not-found-for-current-branch', details: pr.stderr.trim() };
}
console.log(JSON.stringify(report, null, 2));
if (report.status === 'partial' && !allowNoPr) process.exit(3);
