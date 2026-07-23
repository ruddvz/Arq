#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const val = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : null;
};
const pr = val('pr'),
  expected = val('expected-head'),
  execute = args.includes('--execute'),
  confirm = val('confirm'),
  method = val('method') ?? 'squash',
  allowNoChecks = args.includes('--allow-no-checks');
if (!pr || !expected) {
  console.error(
    'Usage: zeus-merge-guard --pr N --expected-head SHA [--method squash|merge|rebase] [--execute --confirm MERGE]',
  );
  process.exit(2);
}
if (!['squash', 'merge', 'rebase'].includes(method)) {
  console.error('Invalid merge method');
  process.exit(2);
}
const gh = (a) => spawnSync('gh', a, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (gh(['--version']).status !== 0) {
  console.error('gh unavailable');
  process.exit(3);
}
const repoR = gh(['repo', 'view', '--json', 'nameWithOwner']);
if (repoR.status !== 0) {
  process.stderr.write(repoR.stderr);
  process.exit(1);
}
const repo = JSON.parse(repoR.stdout).nameWithOwner;
const infoR = gh([
  'pr',
  'view',
  pr,
  '--json',
  'number,isDraft,headRefOid,mergeable,reviewDecision,statusCheckRollup,url',
]);
if (infoR.status !== 0) {
  process.stderr.write(infoR.stderr);
  process.exit(1);
}
const info = JSON.parse(infoR.stdout);
const checks = info.statusCheckRollup ?? [];
const failed = checks.filter((c) =>
  ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(c.conclusion),
);
const pending = checks.filter(
  (c) =>
    !c.conclusion ||
    ['QUEUED', 'IN_PROGRESS', 'PENDING', 'WAITING', 'REQUESTED'].includes(c.status),
);
const blockers = [];
if (info.isDraft) blockers.push('PR is draft');
if (info.headRefOid !== expected) blockers.push(`Head changed: ${info.headRefOid}`);
if (info.mergeable !== 'MERGEABLE') blockers.push(`mergeable=${info.mergeable}`);
if (failed.length) blockers.push(`${failed.length} failed check(s)`);
if (pending.length) blockers.push(`${pending.length} pending check(s)`);
if (!checks.length && !allowNoChecks) blockers.push('No checks reported');
if (info.reviewDecision === 'CHANGES_REQUESTED') blockers.push('Changes requested');
if (info.reviewDecision === 'REVIEW_REQUIRED') blockers.push('Required review missing');
if (blockers.length) {
  console.error(JSON.stringify({ status: 'blocked', blockers, info }, null, 2));
  process.exit(1);
}
if (!execute) {
  console.log(JSON.stringify({ status: 'ready-dry-run', info, method }, null, 2));
  process.exit(0);
}
if (confirm !== 'MERGE') {
  console.error('Execution requires --confirm MERGE');
  process.exit(2);
}
const merge = gh([
  'api',
  '-X',
  'PUT',
  `repos/${repo}/pulls/${pr}/merge`,
  '-f',
  `sha=${expected}`,
  '-f',
  `merge_method=${method}`,
]);
if (merge.status !== 0) {
  process.stderr.write(merge.stderr);
  process.exit(1);
}
const result = JSON.parse(merge.stdout);
if (!result.merged) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      status: 'merged',
      repository: repo,
      pr: Number(pr),
      expectedHead: expected,
      mergeResult: result,
    },
    null,
    2,
  ),
);
