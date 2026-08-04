#!/usr/bin/env node
/**
 * Repository-native Vercel build: produces one static artifact holding both public
 * surfaces - the marketing site at `/` and the browser editor at `/app/`.
 *
 * This is deliberately the same build contract `.github/workflows/deploy-pages.yml`
 * runs, not a second one. Pages and Vercel differ in exactly two inputs: Pages serves
 * the site under the `/Arq` project subpath and Vercel serves it at the root, so
 * `SITE_BASE_PATH` differs and `/Arq/*` becomes a compatibility redirect (vercel.json).
 * Everything else - the language-system gates, the route-coverage gate, the rendered
 * public-copy audit and the commit-bound proof - runs identically, so a green Vercel
 * build is evidence about the same product Pages already publishes and the two hosts
 * stay a rollback pair rather than diverging deployments.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, 'dist');
const marketingDist = join(root, 'apps', 'marketing', 'dist');
const editorDist = join(root, 'apps', 'web', 'dist');

function run(command, args, env) {
  process.stdout.write(`> ${command} ${args.join(' ')}\n`);
  execFileSync(command, args, { cwd: root, env, stdio: 'inherit' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * The proof file name is the Language System's to choose, not this script's - reading
 * it back from the same contract the verifier writes against keeps a rename from
 * silently producing a deployment with no provenance attached to it.
 */
const siteContract = readJson(
  join(root, 'docs', 'product', 'voice', 'deployed-site-contract.json'),
);
const proofFileName = siteContract.proof?.fileName ?? 'arq-language-site-proof.json';

function currentRevision() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

const sourceCommit = currentRevision();
if (!/^[0-9a-f]{7,64}$/i.test(sourceCommit)) {
  throw new Error(`Refusing to build without a resolvable source commit (got "${sourceCommit}").`);
}

// Preview deployments get VERCEL_URL; production gets the project production URL. A
// custom canonical domain overrides both through SITE_ORIGIN, which is what the
// production cutover will set - so canonical URLs, the sitemap and the proof all name
// the host the deployment is actually reachable at rather than a hardcoded one.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const deploymentHost = process.env.VERCEL_URL;
const siteOrigin =
  process.env.SITE_ORIGIN ??
  (productionHost
    ? `https://${productionHost}`
    : deploymentHost
      ? `https://${deploymentHost}`
      : '');

const buildEnv = {
  ...process.env,
  // Root-served, unlike Pages' `/Arq` project subpath. vercel.json redirects the old
  // prefix so links published against the Pages URL keep resolving.
  SITE_BASE_PATH: '',
  SITE_ORIGIN: siteOrigin,
};

rmSync(output, { recursive: true, force: true });

run('pnpm', ['arq:language:verify'], buildEnv);
run('pnpm', ['arq:language:routes:verify'], buildEnv);
run('pnpm', ['--filter', '@arq/marketing', 'build'], buildEnv);
run(
  'pnpm',
  [
    'arq:language:site:build:verify',
    '--',
    '--site-root',
    'apps/marketing/dist',
    '--write-proof',
    '--commit',
    sourceCommit,
  ],
  buildEnv,
);
// The editor is served from `/app/`, so its asset URLs have to be built for that
// prefix; Vite would otherwise emit root-absolute `/assets/...` URLs that would
// collide with the marketing site's own unhashed `/assets/` directory.
run('pnpm', ['--filter', '@arq/web', 'exec', 'vite', 'build', '--base=/app/'], buildEnv);

for (const requiredPath of [
  join(marketingDist, 'index.html'),
  join(marketingDist, '404.html'),
  join(marketingDist, proofFileName),
  join(editorDist, 'index.html'),
]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required Vercel artifact is missing: ${requiredPath}`);
  }
}

mkdirSync(output, { recursive: true });
cpSync(marketingDist, output, { recursive: true });
cpSync(editorDist, join(output, 'app'), { recursive: true });

// Provenance is written into the artifact, not just logged, so the deployed origin can
// be checked against the exact commit it claims to come from after the fact.
const proofPath = join(output, proofFileName);
const proof = readJson(proofPath);
proof.vercelDeployment = {
  sourceRepository: process.env.VERCEL_GIT_REPO_SLUG ?? 'ruddvz/Arq',
  sourceRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  sourceCommit,
  siteOrigin: siteOrigin || null,
  includesBrowserEditor: true,
  deploymentMode: 'repository-native',
};
writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

writeFileSync(
  join(output, 'deployment-source.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      repository: process.env.VERCEL_GIT_REPO_SLUG ?? 'ruddvz/Arq',
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      commit: sourceCommit,
      siteOrigin: siteOrigin || null,
      surfaces: ['marketing', 'browser-editor'],
      publicSiteProof: proofFileName,
      compatibilityRedirect: '/Arq/* -> /*',
      deploymentMode: 'repository-native',
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(`Arq Vercel artifact prepared from ${sourceCommit}.\n`);
