#!/usr/bin/env node
/**
 * Secret scan over git-tracked text files.
 *
 * The security workflow promised "secret scan" from the first commit but ran
 * an echo. This is the real, dependency-free version: high-precision
 * patterns only (provider-prefixed token formats and private-key blocks), so
 * a finding is worth failing the build over - deliberately no generic
 * "password =" heuristic, whose false positives against test fixtures would
 * train everyone to ignore the gate.
 *
 * A line can opt out with `secret-scan: allow` in a comment when it is a
 * documented, deliberate example (none exist today).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PATTERNS = [
  { name: 'AWS access key id', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: 'Private key block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    name: 'GitHub token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  },
  { name: 'GitLab token', regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Stripe live secret key', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'OpenAI key', regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Anthropic key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'npm token', regex: /\bnpm_[A-Za-z0-9]{36}\b/ },
];

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.pdf',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.wasm',
  '.zip',
  '.arq',
  '.sqlite',
  '.webmanifest',
]);

const files = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\0')
  .filter((name) => name !== '')
  .filter((name) => !BINARY_EXTENSIONS.has(path.extname(name).toLowerCase()));

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(path.join(repoRoot, file), 'utf8');
  } catch {
    continue; // deleted-but-listed or unreadable; nothing to scan
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('secret-scan: allow')) {
      continue;
    }
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push(`${file}:${i + 1}: ${pattern.name}`);
      }
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`Potential secrets found (${findings.length}):\n`);
  for (const finding of findings) {
    process.stderr.write(`  ${finding}\n`);
  }
  process.stderr.write(
    'If a match is a deliberate, documented example, mark its line with `secret-scan: allow`.\n',
  );
  process.exit(1);
}

process.stdout.write(`Secret scan: ${files.length} tracked text files, no findings.\n`);
