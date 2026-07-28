#!/usr/bin/env node
/**
 * PostToolUse guardian for edited copy surfaces.
 * Warn-only. Blocking remains the CI audit.
 */
import { readFileSync } from 'node:fs';
import { scanFile } from './arq-language-patterns.mjs';

let input = '';
try {
  input = readFileSync('/dev/stdin', 'utf8');
} catch {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const toolName = payload?.tool_name ?? '';
if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) process.exit(0);

const filePath =
  payload?.tool_input?.file_path ??
  payload?.tool_input?.path ??
  payload?.tool_input?.edits?.[0]?.file_path ??
  '';

if (!filePath) process.exit(0);

const rel = filePath.replace(/^.*\/Arq\//, '');
const inScope =
  /^apps\/marketing\/src\//.test(rel) ||
  /^apps\/web\/src\//.test(rel) ||
  /^packages\/design-system\/src\//.test(rel) ||
  /^packages\/workspace\/src\/registry\/.*\.json$/.test(rel);

const isTest = /\.(test|spec)\.[tj]sx?$/.test(rel) || /__tests__\//.test(rel);
if (!inScope || isTest) process.exit(0);

let text = '';
try {
  text = readFileSync(filePath, 'utf8');
} catch {
  process.exit(0);
}

const findings = scanFile(rel, text);
if (!findings.length) process.exit(0);

const lines = findings.map((finding) => {
  const hits = [...new Set(finding.hits)].slice(0, 5).join(' | ');
  return `  ${finding.severity.toUpperCase()} ${finding.label}: ${hits}\n    ${finding.note}`;
});

process.stderr.write(
  `[arq-language] ${findings.length} finding group(s) in ${rel}\n${lines.join('\n')}\n` +
    `  Canonical standard: docs/product/VOICE-SYSTEM.md and PRODUCT-COPY-PRINCIPLES.md\n` +
    `  Hook is warn-only. Hard findings block through arq:language:audit:ci.\n`,
);

process.exit(0);
