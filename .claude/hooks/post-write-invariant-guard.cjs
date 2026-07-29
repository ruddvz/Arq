#!/usr/bin/env node
// Zeus 5 invariant guard.
//
// The Arq Language System 4.1 already owns em dashes, hype, prohibited public
// claims, AI authority claims and interoperability overclaims, with real scope
// resolution (`scripts/arq-language-patterns.mjs`) and a warn-at-write,
// block-in-CI split. Re-implementing those checks here with path heuristics
// would be less precise and would double-report, so this guard is reduced to:
//
//   1. product-safety absolutes that HARD_CLAIMS does not already carry;
//   2. files outside `scripts/arq-language-guardian.mjs` scope, so the two
//      hooks never report on the same file.
//
// Warn-only, matching the repository's write-time convention. Hard enforcement
// for governed copy stays with `pnpm arq:language:audit:ci`.
const fs = require('node:fs');
const path = require('node:path');

const CHECKS = [
  {
    label: 'unsupported storage, sync, privacy or security absolute',
    re: /\b(?:corruption[- ]proof|crash[- ]proof|conflict[- ]free|zero[- ]knowledge|military[- ]grade|unhackable|impossible to (?:corrupt|lose))\b/gi,
    note: 'Name the tested behaviour and its limits instead of an absolute.',
  },
  {
    label: 'unsupported professional or compliance claim',
    re: /\b(?:guarantees?|certifies?|ensures?)\s+(?:code compliance|structural safety|professional approval|regulatory approval)\b/gi,
    note: 'Arq does not claim professional approval, structural safety or code compliance without a separately authorised system and evidence.',
  },
  {
    label: 'AI mutation claim missing control language',
    re: /\bAI\s+(?:directly|automatically)\s+(?:edits|changes|modifies|applies to)\s+(?:the\s+)?(?:model|project)\b/gi,
    note: 'AI proposes typed operations with assumptions, validation, preview, apply and reject.',
    requiresAbsenceOf: /(?:preview|validation|validate|review|approve|permission|propose)/i,
  },
];

// Mirrors scripts/arq-language-guardian.mjs so the two hooks do not overlap.
const LANGUAGE_GUARDIAN_SCOPE = [
  /^apps\/marketing\/src\//,
  /^apps\/web\/src\//,
  /^packages\/design-system\/src\//,
  /^packages\/workspace\/src\/registry\/.*\.json$/,
];

function inLanguageGuardianScope(rel) {
  if (LANGUAGE_GUARDIAN_SCOPE.some((re) => re.test(rel))) return true;
  return (
    /^docs\/(?:pages|product|ai|interoperability)\//.test(rel) &&
    !/^docs\/product\/voice\//.test(rel)
  );
}

// Places that legitimately quote rejected wording.
const QUOTES_REJECTED_PATTERNS = /^(?:\.claude|\.zeus|engineering|scripts|quality|validation)\//;

let input = '';
process.stdin.on('data', (d) => {
  input += d;
});
process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    process.exit(0);
  }

  const filePath = String(
    payload?.tool_input?.file_path ||
      payload?.tool_input?.path ||
      payload?.tool_input?.edits?.[0]?.file_path ||
      '',
  );
  if (!filePath) process.exit(0);

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    process.exit(0);
  }
  if (stat.isDirectory()) process.exit(0);
  if (!/\.(?:md|mdx|txt|html|tsx?|jsx?|json)$/i.test(filePath)) process.exit(0);

  const rel = path.relative(process.cwd(), filePath).split(path.sep).join('/');
  if (rel.startsWith('..')) process.exit(0);
  if (inLanguageGuardianScope(rel)) process.exit(0);
  if (QUOTES_REJECTED_PATTERNS.test(rel)) process.exit(0);
  if (/\.(?:test|spec)\.[tj]sx?$/.test(rel) || /(?:^|\/)(?:__tests__|fixtures?)\//.test(rel))
    process.exit(0);

  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
  }

  const findings = [];
  for (const check of CHECKS) {
    check.re.lastIndex = 0;
    const hits = text.match(check.re);
    if (!hits) continue;
    if (check.requiresAbsenceOf && check.requiresAbsenceOf.test(text)) continue;
    findings.push(
      `  ${check.label}: ${[...new Set(hits)].slice(0, 5).join(' | ')}\n    ${check.note}`,
    );
  }

  if (findings.length) {
    process.stderr.write(
      `[zeus-invariant] ${findings.length} finding group(s) in ${rel}\n${findings.join('\n')}\n` +
        `  Invariants: .zeus/INVARIANTS.md sections J and M\n` +
        `  Hook is warn-only. Governed copy blocks through arq:language:audit:ci.\n`,
    );
  }
  process.exit(0);
});
