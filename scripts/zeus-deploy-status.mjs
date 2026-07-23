#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const at = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : null;
};
const sha = at('sha');
const gh = (a) => spawnSync('gh', a, { encoding: 'utf8' });
if (gh(['--version']).status !== 0) {
  console.error(JSON.stringify({ status: 'blocked', reason: 'gh CLI unavailable' }, null, 2));
  process.exit(3);
}
const repoR = gh(['repo', 'view', '--json', 'nameWithOwner']);
if (repoR.status !== 0) {
  process.stderr.write(repoR.stderr);
  process.exit(1);
}
const repo = JSON.parse(repoR.stdout).nameWithOwner;
const endpoint = `repos/${repo}/deployments?per_page=20${sha ? `&sha=${encodeURIComponent(sha)}` : ''}`;
const depR = gh(['api', endpoint]);
if (depR.status !== 0) {
  process.stderr.write(depR.stderr);
  process.exit(1);
}
const deployments = JSON.parse(depR.stdout);
const results = [];
for (const d of deployments) {
  const s = gh(['api', `repos/${repo}/deployments/${d.id}/statuses?per_page=1`]);
  const statuses = s.status === 0 ? JSON.parse(s.stdout) : [];
  results.push({
    id: d.id,
    sha: d.sha,
    environment: d.environment,
    createdAt: d.created_at,
    latestStatus: statuses[0] ?? null,
  });
}
const matching = sha ? results.filter((x) => x.sha === sha) : results;
const latestByEnvironment = [];
const seen = new Set();
for (const item of matching) {
  const key = item.environment ?? 'default';
  if (!seen.has(key)) {
    seen.add(key);
    latestByEnvironment.push(item);
  }
}
const success =
  latestByEnvironment.length > 0 &&
  latestByEnvironment.every((x) => x.latestStatus?.state === 'success');
console.log(
  JSON.stringify(
    {
      repository: repo,
      requestedSha: sha,
      status: latestByEnvironment.length ? (success ? 'success' : 'not-success') : 'unknown',
      deployments: latestByEnvironment,
    },
    null,
    2,
  ),
);
process.exit(latestByEnvironment.length ? (success ? 0 : 1) : 3);
