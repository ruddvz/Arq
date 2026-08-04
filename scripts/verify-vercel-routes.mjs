#!/usr/bin/env node
/**
 * Checks the routing, status codes, caching and security headers a deployed Arq
 * origin actually returns.
 *
 * Deliberately separate from `verify-arq-deployed-public-site.mjs`, which is the
 * Language System's instrument: that one reads the commit-bound proof and every
 * public route's HTML back off the origin to prove the *copy* deployed is the
 * copy audited. This one proves the *routing contract in `vercel.json`* holds -
 * the editor answers at `/app/`, deep editor routes fall back to the shell, the
 * legacy `/Arq/...` prefix still redirects, an unknown path is a branded 404 with
 * a 404 status, and the cache split does not mark unhashed assets immutable.
 * Neither subsumes the other, and merging them would give one script two owners.
 *
 * Usage:
 *   node scripts/verify-vercel-routes.mjs --base-url https://<origin> [--expected-commit <sha>]
 *
 * `--bypass-token` sends Vercel's deployment-protection bypass header, so a
 * protected preview can be checked without turning protection off for everyone.
 *
 * Exit 0 only when every check passes. A network failure is a failure, never a
 * skip: an unreachable origin is not evidence that routing is correct.
 */

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const baseUrl = (value('--base-url', process.env.ARQ_DEPLOYMENT_URL ?? '') || '').replace(
  /\/$/,
  '',
);
const expectedCommit = value('--expected-commit', process.env.GITHUB_SHA ?? '');
const bypassToken = value('--bypass-token', process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '');
const attempts = Number(value('--attempts', '3'));
const delayMs = Number(value('--delay-ms', '5000'));
/** How long to wait for the origin to start serving `--expected-commit` before failing. */
const waitForCommitMs = Number(value('--wait-for-commit-ms', '600000'));

if (!/^https?:\/\//.test(baseUrl)) {
  console.error('FAIL --base-url is required, e.g. --base-url https://arq-website.vercel.app');
  process.exit(1);
}

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
const pass = (message) => console.log(`PASS ${message}`);

const headers = bypassToken ? { 'x-vercel-protection-bypass': bypassToken } : {};

async function fetchOnce(path, redirect) {
  const response = await fetch(`${baseUrl}${path}`, { redirect, headers });
  const text = response.headers.get('content-type')?.includes('json')
    ? await response.text()
    : await response.text();
  return { status: response.status, headers: response.headers, body: text };
}

/**
 * A deployment can be propagating rather than wrong, so a transport error is
 * retried. A definite HTTP response is never retried - re-asking a server that
 * already answered 500 does not make the answer better evidence.
 */
async function request(path, { redirect = 'manual' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await fetchOnce(path, redirect);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function expectStatus(label, actual, expected) {
  if (actual === expected) pass(`${label} -> HTTP ${actual}`);
  else fail(`${label} -> HTTP ${actual}, expected ${expected}`);
}

function expectHeader(label, response, name, predicate, description) {
  const actual = response.headers.get(name);
  if (actual !== null && predicate(actual)) pass(`${label} ${name}: ${actual}`);
  else fail(`${label} ${name} is "${actual}", expected ${description}`);
}

/**
 * Waits until the origin is serving the commit we mean to check.
 *
 * A branch alias points at whatever deployed most recently, so running straight
 * away can check the *previous* deployment and report a pass that says nothing
 * about this commit. Polling the provenance file first removes that race, and
 * removes it in the honest direction: exhausting the window is a failure, not a
 * skip. Without `--expected-commit` there is nothing to wait for, so this is a
 * no-op and the checks describe whatever is currently live.
 */
async function awaitExpectedCommit() {
  if (!expectedCommit) return;
  const deadline = Date.now() + waitForCommitMs;
  let lastSeen = 'nothing';
  for (;;) {
    try {
      const response = await request('/deployment-source.json', { redirect: 'follow' });
      if (response.status === 200) {
        const parsed = JSON.parse(response.body);
        if (parsed.commit === expectedCommit) {
          pass(`origin is serving the expected commit ${expectedCommit}`);
          return;
        }
        lastSeen = parsed.commit ?? 'no commit field';
      } else {
        lastSeen = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastSeen = `unreachable (${error?.message ?? error})`;
    }
    if (Date.now() >= deadline) {
      fail(
        `origin never served ${expectedCommit} within ${Math.round(waitForCommitMs / 1000)}s; last saw ${lastSeen}`,
      );
      return;
    }
    console.log(`  waiting for ${expectedCommit}; currently ${lastSeen}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function main() {
  console.log(`Verifying Arq deployment routing at ${baseUrl}`);
  if (bypassToken) console.log('Using deployment-protection bypass header.');

  await awaitExpectedCommit();
  if (failures > 0) {
    console.error('\nRefusing to report on routes: the expected deployment never became live.');
    process.exit(1);
  }

  // 1. Marketing site at the root.
  const root = await request('/', { redirect: 'follow' });
  expectStatus('/', root.status, 200);
  if (!/<html/i.test(root.body)) fail('/ did not return an HTML document');
  else pass('/ returns an HTML document');

  // 2. The browser editor at /app/, and its deep-route fallback. Both must serve
  //    the editor shell - a deep route returning 404 is the classic SPA
  //    misconfiguration this rewrite exists to prevent.
  const app = await request('/app/', { redirect: 'follow' });
  expectStatus('/app/', app.status, 200);
  const appAssetMatch = app.body.match(/\/app\/assets\/[A-Za-z0-9._-]+\.js/);
  if (appAssetMatch) pass(`/app/ references a root-based editor asset (${appAssetMatch[0]})`);
  else fail('/app/ did not reference an /app/assets/*.js bundle');

  const deep = await request('/app/project/some/deep/route', { redirect: 'follow' });
  expectStatus('/app/ deep route', deep.status, 200);
  if (appAssetMatch && deep.body.includes(appAssetMatch[0])) {
    pass('/app/ deep route falls back to the same editor shell');
  } else {
    fail('/app/ deep route did not return the editor shell');
  }

  // 3. Editor assets: hashed, therefore safe to cache immutably.
  if (appAssetMatch) {
    const asset = await request(appAssetMatch[0], { redirect: 'follow' });
    expectStatus('editor asset', asset.status, 200);
    expectHeader('editor asset', asset, 'cache-control', (v) => /immutable/.test(v), 'immutable');
  }

  // 4. Marketing assets are NOT content-hashed (apps/marketing emits
  //    /assets/site.css), so marking them immutable would strand a stale
  //    stylesheet in caches for a year.
  const siteCss = await request('/assets/site.css', { redirect: 'follow' });
  if (siteCss.status === 200) {
    expectHeader(
      'marketing asset',
      siteCss,
      'cache-control',
      (v) => !/immutable/.test(v),
      'not immutable',
    );
  } else {
    fail(`/assets/site.css -> HTTP ${siteCss.status}, expected 200`);
  }

  // 5. HTML must revalidate, or a deploy is invisible until caches expire.
  expectHeader(
    '/',
    root,
    'cache-control',
    (v) => /max-age=0|no-cache|must-revalidate/.test(v),
    'revalidated',
  );

  // 6. Legacy GitHub Pages paths keep resolving after the move to root serving.
  const legacyRoot = await request('/Arq');
  expectStatus('/Arq', legacyRoot.status, 308);
  const legacyNested = await request('/Arq/product');
  expectStatus('/Arq/product', legacyNested.status, 308);
  const location = legacyNested.headers.get('location');
  if (location && /\/product$/.test(location)) pass(`/Arq/product redirects to ${location}`);
  else fail(`/Arq/product redirect Location is "${location}", expected to end with /product`);

  // 7. A branded 404 that actually returns 404 - a styled page served with 200
  //    is a soft 404 and gets indexed.
  const missing = await request('/definitely-not-a-real-arq-page', { redirect: 'follow' });
  expectStatus('unknown path', missing.status, 404);
  if (/<html/i.test(missing.body)) pass('unknown path returns a branded HTML page');
  else fail('unknown path did not return an HTML document');

  // 8. Security headers on every path.
  for (const [name, expected] of [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
  ]) {
    expectHeader('/', root, name, (v) => v.toLowerCase() === expected.toLowerCase(), expected);
  }

  // 9. Provenance: the deployment says which commit it came from, and - when a
  //    commit is supplied - that it is the expected one. This is what stops a
  //    passing route check from approving a stale deployment.
  const provenance = await request('/deployment-source.json', { redirect: 'follow' });
  expectStatus('/deployment-source.json', provenance.status, 200);
  if (provenance.status === 200) {
    try {
      const parsed = JSON.parse(provenance.body);
      pass(`deployment provenance: commit ${parsed.commit}, mode ${parsed.deploymentMode}`);
      if (expectedCommit && parsed.commit !== expectedCommit) {
        fail(`deployed commit ${parsed.commit} is not the expected ${expectedCommit}`);
      } else if (expectedCommit) {
        pass(`deployed commit matches ${expectedCommit}`);
      }
    } catch {
      fail('/deployment-source.json is not valid JSON');
    }
  }

  console.log(
    failures === 0
      ? '\nAll Arq deployment route checks passed.'
      : `\n${failures} deployment route check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  // An unreachable origin is a failed check, not an absent one.
  console.error(`FAIL deployment routing check could not complete: ${error?.message ?? error}`);
  process.exit(1);
});
