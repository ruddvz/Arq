#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const val = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const allowNoSmoke = args.includes('--allow-no-smoke');
const sha = val('sha');
if (!sha) {
  console.error(
    'Usage: zeus-release-watch --sha SHA [--timeout 900] [--interval 15] [--health-url URL ...]',
  );
  process.exit(2);
}
const timeout = Number(val('timeout', '900')),
  interval = Number(val('interval', '15'));
const health = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--health-url') health.push(args[i + 1]);
const gh = (a) => spawnSync('gh', a, { encoding: 'utf8' });
if (gh(['--version']).status !== 0) {
  console.error('gh unavailable');
  process.exit(3);
}
const start = Date.now();
let workflows = [];
while (true) {
  const r = gh([
    'run',
    'list',
    '--commit',
    sha,
    '--json',
    'databaseId,workflowName,status,conclusion,url',
    '--limit',
    '50',
  ]);
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    process.exit(1);
  }
  workflows = JSON.parse(r.stdout);
  const active = workflows.some((x) =>
    ['queued', 'in_progress', 'requested', 'waiting', 'pending'].includes(x.status),
  );
  if (!active) break;
  if ((Date.now() - start) / 1000 > timeout) {
    console.error(JSON.stringify({ status: 'timeout', workflows }, null, 2));
    process.exit(1);
  }
  await new Promise((res) => setTimeout(res, interval * 1000));
}
const wfFailed = workflows.filter(
  (x) => x.conclusion && !['success', 'skipped', 'neutral'].includes(x.conclusion),
);
const probes = [];
for (const url of health) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    probes.push({
      url: new URL(url).origin + new URL(url).pathname,
      status: res.status,
      ok: res.ok,
    });
  } catch (e) {
    let safe = url;
    try {
      const u = new URL(url);
      safe = u.origin + u.pathname;
    } catch {}
    probes.push({ url: safe, ok: false, error: String(e) });
  }
}
const deploy = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('./zeus-deploy-status.mjs', import.meta.url)), '--sha', sha],
  { encoding: 'utf8' },
);
let deployment;
try {
  deployment = JSON.parse(deploy.stdout || deploy.stderr);
} catch {
  deployment = { status: 'unknown', raw: (deploy.stdout + deploy.stderr).trim() };
}
const failed = wfFailed.length || probes.some((p) => !p.ok) || deployment.status === 'not-success';
const unknown =
  deployment.status === 'unknown' ||
  deployment.status === 'blocked' ||
  (!allowNoSmoke && probes.length === 0);
console.log(
  JSON.stringify(
    {
      status: failed ? 'failed' : unknown ? 'partial' : 'green',
      sha,
      workflows,
      deployment,
      healthProbes: probes,
    },
    null,
    2,
  ),
);
process.exit(failed ? 1 : unknown ? 3 : 0);
