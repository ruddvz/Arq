#!/usr/bin/env node
/**
 * Pins scripts/check-secrets.mjs, in the same standalone shape as
 * scripts/zeus-guard-test.mjs.
 *
 * The scanner guarded this repository from its first commit with nothing
 * establishing that any of its ten patterns still matched. A regex broken by
 * an edit would have gone on reporting a clean tree for ever, which is the
 * most reassuring possible way for a security control to fail. Every pattern
 * now has to prove it fires.
 *
 * Sample tokens are assembled from fragments at runtime rather than written
 * out whole, so this file cannot trip the very scanner it tests - a real
 * concern, because the scanner reads every git-tracked text file including
 * this one. The one deliberate exception is the allow-marker case, which has
 * to contain a matching literal to be worth anything.
 */

import { ALLOW_MARKER, SECRET_PATTERNS, scanText } from './check-secrets.mjs';

let failures = 0;
function check(description, condition) {
  if (condition) {
    process.stdout.write(`PASS ${description}\n`);
  } else {
    failures += 1;
    process.stderr.write(`FAIL ${description}\n`);
  }
}

/** Split so the literal never appears in this file's source. */
const SAMPLES = {
  'AWS access key id': 'AKIA' + 'ABCDEFGHIJKLMNOP',
  'Private key block': '-----BEGIN ' + 'PRIVATE KEY-----',
  'GitHub token': 'ghp_' + 'a'.repeat(36),
  'GitLab token': 'glpat-' + 'a'.repeat(20),
  'Slack token': 'xoxb-' + '1234567890abc',
  'Google API key': 'AIza' + 'a'.repeat(35),
  'Stripe live secret key': 'sk_live_' + 'a'.repeat(16),
  'OpenAI key': 'sk-proj-' + 'a'.repeat(20),
  'Anthropic key': 'sk-ant-' + 'a'.repeat(20),
  'npm token': 'npm_' + 'a'.repeat(36),
};

// Every declared pattern must have a sample, so adding a pattern without
// proving it fires fails here rather than shipping unmeasured.
check(
  'every declared pattern has a sample',
  SECRET_PATTERNS.every((pattern) => pattern.name in SAMPLES) &&
    Object.keys(SAMPLES).length === SECRET_PATTERNS.length,
);

for (const pattern of SECRET_PATTERNS) {
  const sample = SAMPLES[pattern.name];
  const findings = scanText(`const token = '${sample}';`);
  check(
    `${pattern.name} is detected`,
    findings.some((finding) => finding.name === pattern.name),
  );
}

// Precision matters more than recall here: the module's own doc says a finding
// must be worth failing the build over, so ordinary code must stay silent.
const INNOCENT = [
  "const password = 'hunter2';",
  'const key = process.env.API_KEY;',
  'AKIA is an AWS key prefix.',
  'sk-proj is not a key by itself.',
  '-----BEGIN CERTIFICATE-----',
  'ghp_short',
].join('\n');
check('ordinary lines produce no findings', scanText(INNOCENT).length === 0);

// The documented opt-out. This line carries a real matching token on purpose.
const allowed = `const example = 'AKIA${'ABCDEFGHIJKLMNOP'}'; // ${ALLOW_MARKER}`;
check('a line marked with the allow marker is skipped', scanText(allowed).length === 0);

// Line numbers are what a person uses to find the thing; off-by-one makes the
// report actively misleading.
const positioned = ['first', 'second', `const t = '${SAMPLES['npm token']}';`].join('\n');
check('reports a 1-based line number', scanText(positioned)[0]?.line === 3);

check('an empty file produces no findings', scanText('').length === 0);

if (failures > 0) {
  process.stderr.write(`\nSecret-scanner test failed (${failures} case(s)).\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `\nSecret-scanner test passed (${SECRET_PATTERNS.length} patterns, 5 behaviours).\n`,
  );
}
