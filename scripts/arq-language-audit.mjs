#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { scanFile, CODE_EXT, DOC_EXT, JSON_EXT } from './arq-language-patterns.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const CI = args.includes('--ci');
const JSON_OUT = args.includes('--json');
const INCLUDE_SPECS = args.includes('--specs');
const REVIEW_REQUIRED = args.includes('--review-required');
const ACK_PATH = args.includes('--acknowledgements')
  ? args[args.indexOf('--acknowledgements') + 1]
  : join(ROOT, 'docs/product/voice/language-audit-acknowledgements.json');

const BASES = [
  'apps/marketing/src',
  'apps/web/src',
  'packages/design-system/src',
  'packages/workspace/src/registry',
];

if (INCLUDE_SPECS) {
  BASES.push('docs/pages', 'docs/product', 'docs/ai', 'docs/interoperability');
}

const SKIP = new Set(['node_modules', 'dist', 'dist-build', 'coverage', '.git', '__snapshots__']);

function isTest(path) {
  return /\.(test|spec)\.[tj]sx?$/.test(path) || /__tests__\//.test(path);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const targets = [];
for (const base of BASES) {
  const fullBase = join(ROOT, base);
  if (!existsSync(fullBase)) continue;

  for (const file of walk(fullBase)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (isTest(rel)) continue;
    if (!(CODE_EXT.test(rel) || DOC_EXT.test(rel) || JSON_EXT.test(rel))) continue;
    if (statSync(file).size > 2_000_000) continue;
    targets.push(rel);
  }
}

const results = [];
const totals = {};
let acknowledgements = [];
if (REVIEW_REQUIRED && existsSync(ACK_PATH)) {
  try {
    acknowledgements = JSON.parse(readFileSync(ACK_PATH, 'utf8')).acknowledgements ?? [];
  } catch {
    console.error(`FAIL invalid language audit acknowledgements: ${ACK_PATH}`);
    process.exit(1);
  }
}
function acknowledged(file, finding) {
  const today = new Date().toISOString().slice(0, 10);
  return acknowledgements.some(
    (entry) =>
      entry.ruleId === finding.id &&
      entry.sourcePath === file &&
      typeof entry.expiresOn === 'string' &&
      entry.expiresOn >= today &&
      typeof entry.reason === 'string' &&
      entry.reason.trim() &&
      typeof entry.evidencePath === 'string' &&
      entry.evidencePath.trim() &&
      typeof entry.reviewerRole === 'string' &&
      entry.reviewerRole.trim(),
  );
}

for (const rel of targets) {
  let text = '';
  try {
    text = readFileSync(join(ROOT, rel), 'utf8');
  } catch {
    continue;
  }

  const findings = scanFile(rel, text).filter((finding) => {
    if (!CI) return true;
    if (finding.severity === 'hard') return true;
    if (REVIEW_REQUIRED && finding.reviewRequired && !acknowledged(rel, finding)) return true;
    return false;
  });
  if (!findings.length) continue;

  results.push({ file: rel, findings });

  for (const finding of findings) {
    totals[finding.id] ??= {
      label: finding.label,
      severity: finding.severity,
      reviewRequired: finding.reviewRequired === true,
      files: 0,
      hits: 0,
    };
    totals[finding.id].files += 1;
    totals[finding.id].hits += finding.hits.length;
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned: targets.length, files: results, totals }, null, 2));
} else {
  for (const result of results) {
    console.log(`\n${result.file}`);
    for (const finding of result.findings) {
      const unique = [...new Set(finding.hits)].slice(0, 6);
      const more =
        finding.hits.length > unique.length
          ? ` (+${finding.hits.length - unique.length} more)`
          : '';
      console.log(
        `  [${finding.severity.toUpperCase()}] ${finding.label}: ${unique.join(' | ')}${more}`,
      );
      console.log(`    ${finding.note}`);
    }
  }

  console.log(`\nArq language audit scanned ${targets.length} files.`);
  for (const total of Object.values(totals)) {
    console.log(
      `  ${total.severity === 'hard' || (REVIEW_REQUIRED && total.reviewRequired) ? 'FAIL' : 'WARN'} ${total.label}: ${total.hits} hit(s) in ${total.files} file(s)`,
    );
  }

  if (!Object.keys(totals).length) {
    console.log(CI ? 'No hard language violations. Gate PASS.' : 'No language findings.');
  }
}

const hardHits = Object.values(totals)
  .filter((item) => item.severity === 'hard')
  .reduce((sum, item) => sum + item.hits, 0);
const reviewHits = Object.values(totals)
  .filter((item) => item.reviewRequired)
  .reduce((sum, item) => sum + item.hits, 0);

if (CI && (hardHits > 0 || (REVIEW_REQUIRED && reviewHits > 0))) {
  console.error(
    `\nArq language CI gate failed with ${hardHits} hard and ${REVIEW_REQUIRED ? reviewHits : 0} unacknowledged review-required violation(s).`,
  );
  process.exit(1);
}
