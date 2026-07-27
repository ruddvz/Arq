#!/usr/bin/env node
/** Integration verifier intended to run from the Arq repository root. */
import { existsSync, readFileSync } from 'node:fs';

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
const pass = (m) => console.log(`PASS ${m}`);
const read = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};
const required = [
  'docs/product/VOICE-SYSTEM.md',
  'docs/product/PRODUCT-COPY-PRINCIPLES.md',
  'docs/product/voice/system-map.json',
  'docs/product/voice/context-contract.json',
  'docs/product/voice/snapshot-index.json',
  'docs/product/voice/product-ontology.json',
  'docs/product/voice/state-language-map.json',
  'docs/product/voice/ui-state-adapter-map.json',
  'docs/product/voice/roles-permissions.json',
  'docs/product/voice/format-language-map.json',
  'docs/product/voice/claim-registry.json',
  'docs/product/voice/claim-binding-registry.json',
  'docs/product/voice/conflict-registry.json',
  'docs/product/voice/message-contract.json',
  'docs/product/voice/editorial-authenticity-policy.json',
  'docs/product/voice/public-copy-inventory.json',
  'docs/product/voice/deployed-site-contract.json',
  'docs/product/voice/integration-contract.json',
  'docs/product/voice/generated-repo-context.json',
  'scripts/refresh-arq-language-context.mjs',
  'scripts/verify-arq-language-context.mjs',
  'scripts/verify-arq-language-source-contract.mjs',
  'scripts/verify-arq-state-language-coverage.mjs',
  'scripts/verify-arq-state-adapters.mjs',
  'scripts/verify-arq-language-conflicts.mjs',
  'scripts/verify-arq-language-claims.mjs',
  'scripts/arq-language-editorial-policy.mjs',
  'scripts/verify-arq-public-copy-inventory.mjs',
  'scripts/verify-arq-marketing-route-coverage.mjs',
  'scripts/verify-arq-rendered-public-site.mjs',
  'scripts/verify-arq-deployed-public-site.mjs',
  'scripts/verify-arq-language-installation.mjs',
  'scripts/validate-arq-language-data.mjs',
  'scripts/arq-language-audit.mjs',
];
for (const path of required) existsSync(path) ? pass(`${path} exists`) : fail(`${path} missing`);
const packageJson = read('package.json');
for (const script of [
  'arq:language:install:verify',
  'arq:language:public:verify',
  'arq:language:routes:verify',
  'arq:language:editorial:verify',
  'arq:language:refresh',
  'arq:language:context:verify',
  'arq:language:sources:verify',
  'arq:language:state:verify',
  'arq:language:adapters:verify',
  'arq:language:conflicts:verify',
  'arq:language:claims:verify',
  'arq:language:data:verify',
  'arq:language:verify',
  'arq:language:audit:ci',
  'arq:language:site:build:verify',
  'arq:language:site:live:verify',
  'arq:language:bundle',
  'arq:language:bundle:verify',
]) {
  packageJson.includes(`"${script}"`)
    ? pass(`package.json has ${script}`)
    : fail(`package.json missing ${script}`);
}
const ci = read('.github/workflows/ci.yml');
for (const command of [
  'arq:language:sources:verify',
  'arq:language:install:verify',
  'arq:language:public:verify',
  'arq:language:routes:verify',
  'arq:language:editorial:verify',
  'arq:language:context:verify',
  'arq:language:state:verify',
  'arq:language:adapters:verify',
  'arq:language:conflicts:verify',
  'arq:language:claims:verify',
  'arq:language:verify',
  'arq:language:audit:ci',
  'arq:language:site:build:verify',
]) {
  ci.includes(command) ? pass(`CI runs ${command}`) : fail(`CI missing ${command}`);
}
const refreshIndex = ci.indexOf('arq:language:refresh');
const verifyIndex = ci.indexOf('arq:language:context:verify');
if (refreshIndex >= 0 && (verifyIndex < 0 || refreshIndex < verifyIndex))
  fail('CI must not refresh generated context before freshness verification');
else pass('CI does not self-heal stale context before verification');
const deploy = read('.github/workflows/deploy-pages.yml');
for (const command of ['arq:language:site:build:verify', 'arq:language:site:live:verify']) {
  deploy.includes(command)
    ? pass(`deployment verifies ${command}`)
    : fail(`deployment missing ${command}`);
}
const copy = read('docs/product/PRODUCT-COPY-PRINCIPLES.md').toLowerCase();
for (const phrase of [
  'what happened',
  'what remains safe',
  'local save',
  'sync',
  'permission',
  'read-only',
  'import',
  'export',
  'proposal',
]) {
  copy.includes(phrase)
    ? pass(`product-copy standard contains "${phrase}"`)
    : fail(`product-copy standard lost "${phrase}"`);
}
if (failures) {
  console.error(`\n${failures} Arq language-system integration check(s) failed.`);
  process.exit(1);
}
console.log('\nArq language system integration verification passed.');
