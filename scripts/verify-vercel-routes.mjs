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

const selfTest = args.includes('--self-test');

if (!selfTest && !/^https?:\/\//.test(baseUrl)) {
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
  return { status: response.status, headers: response.headers, body: await response.text() };
}

const looksLikeHtml = (body) => /^\s*(<!doctype html|<html)/i.test(body);

/**
 * Recognises Vercel's deployment-protection interstitial, which is served in
 * place of the deployment's own files. It has to be named specifically: the
 * page is a normal HTML document, so without this the only symptom is JSON
 * parsing failing on "<!DOCTYPE", which reads like a corrupt artifact rather
 * than like an origin that never showed us the artifact at all.
 */
function protectionSignal(response) {
  if (response.status === 401 || response.status === 403) return `HTTP ${response.status}`;
  if (response.status !== 200 || !looksLikeHtml(response.body)) return null;
  const match = response.body.match(
    /_vercel\/sso|vercel\.com\/sso|Authentication Required|Deployment Protection|sso-api/i,
  );
  return match ? `HTTP 200 with "${match[0]}"` : null;
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
 * Pins the protection detector against captured response shapes, so the branch
 * that decides "we were never shown the deployment" is itself verified rather
 * than assumed. Runs in CI immediately before the live probe: this instrument
 * only reports on a real origin, so without this its own logic would be the one
 * untested thing in the check.
 */
function runSelfTest() {
  const sso =
    '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>window.location="https://vercel.com/sso-api?url=x"</script></body></html>';
  const cases = [
    ['SSO interstitial served as 200', { status: 200, body: sso }, true],
    ['protection as 401', { status: 401, body: '<html>Authentication Required</html>' }, true],
    ['protection as 403', { status: 403, body: '' }, true],
    ['the real provenance file', { status: 200, body: '{"commit":"abc"}' }, false],
    // The marketing site legitimately answers with HTML. Treating any HTML body
    // as a protection page would turn a healthy origin into a false blockage.
    [
      'an ordinary HTML page',
      { status: 200, body: '<!doctype html><html><body>Arq</body></html>' },
      false,
    ],
    ['a plain 404', { status: 404, body: 'Not Found' }, false],
  ];
  let broken = 0;
  for (const [label, response, expected] of cases) {
    const actual = protectionSignal(response) !== null;
    if (actual === expected) console.log(`PASS self-test: ${label} -> ${actual}`);
    else {
      console.error(`FAIL self-test: ${label} -> ${actual}, expected ${expected}`);
      broken += 1;
    }
  }
  process.exit(broken === 0 ? 0 : 1);
}

if (selfTest) runSelfTest();

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
  // A settled wrong answer is not a race, so it is confirmed a few times and
  // then reported - rather than re-asked for the whole window, which turns a
  // diagnosable fault into fifteen minutes of identical noise.
  let settledWrongAnswers = 0;
  for (;;) {
    try {
      const response = await request('/deployment-source.json', { redirect: 'follow' });
      const protection = protectionSignal(response);
      if (protection !== null) {
        fail(
          `the origin is protected, so its files were never visible to this check ` +
            `(${protection}). Deployment protection is on for ${baseUrl}, and no bypass ` +
            `token was supplied, so every path returns the sign-in page instead of the ` +
            `deployment. The routing contract is therefore Not inspected: this job fails ` +
            `because it could gather no evidence, not because a route is wrong.\n` +
            `  To make this verifiable: Vercel project settings -> Deployment Protection -> ` +
            `Protection Bypass for Automation, then store the generated value as the ` +
            `VERCEL_AUTOMATION_BYPASS_SECRET repository secret. This script already sends ` +
            `it as the x-vercel-protection-bypass header when it is present.`,
        );
        return;
      }
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
      settledWrongAnswers = 0;
    } catch (error) {
      // A body that is not JSON is a definite answer from a live server, so it
      // is treated as settled. A transport error genuinely can resolve on its
      // own, so it stays a retry.
      const isNotJson = error instanceof SyntaxError;
      lastSeen = isNotJson
        ? `a non-JSON body at /deployment-source.json (${error.message})`
        : `unreachable (${error?.message ?? error})`;
      if (isNotJson && (settledWrongAnswers += 1) >= 3) {
        fail(
          `/deployment-source.json is served, but is not the provenance file this check ` +
            `reads - the origin answered with ${lastSeen} three times running. Either the ` +
            `build did not run scripts/build-vercel.mjs, or something upstream is answering ` +
            `in its place.`,
        );
        return;
      }
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
    console.error(
      '\nRefusing to report on routes: no evidence about the deployed routing was obtainable. ' +
        'An unreachable or unreadable origin is not evidence that routing is correct.',
    );
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
