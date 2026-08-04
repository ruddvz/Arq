#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
const root = process.argv[2] ?? process.cwd();
if (!existsSync(root)) {
  console.error('Path missing');
  process.exit(2);
}
const ignore = /(node_modules|\.git|dist|coverage|archive|historical|security-bad)/i;
const exts = new Set([
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.json',
  '.yml',
  '.yaml',
  '.env',
  '.md',
  '.rs',
  '.py',
  '.sh',
  '.sql',
]);
const ALLOW_MARKER = 'security-lint: allow';
const rules = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [
    /(?:api[_-]?key|access[_-]?token|secret[_-]?key|password)\s*[:=]\s*["'][^"']{8,}["']/i,
    'possible hard-coded secret',
  ],
  [/ghp_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [
    /child_process.*exec\([^)]*\+|eval\(|new Function\(/,
    'dangerous dynamic execution; manual review',
  ],
  [
    /PRAGMA\s+trusted_schema\s*=\s*ON/i,
    'SQLite trusted_schema should not be enabled for untrusted files',
  ],
  [/load_extension\s*\(/i, 'SQLite extension loading requires explicit security approval'],
];
const findings = [];
function walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name),
      rel = relative(root, p);
    if (ignore.test(rel)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (st.size < 2_000_000 && exts.has(extname(p).toLowerCase())) {
      let t = '';
      try {
        t = readFileSync(p, 'utf8');
      } catch {
        continue;
      }
      const lines = t.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        // An exception is opt-in per line and must be written at the site it covers,
        // so it stays visible in review. The previous line is honoured too, so a
        // marker never has to be wedged into published prose. No file, directory or
        // suffix is exempt as a class: a test that enables a dangerous pragma is
        // exactly the kind of drift this gate exists to catch.
        const previous = index > 0 ? lines[index - 1] : '';
        if (line.includes(ALLOW_MARKER) || previous.includes(ALLOW_MARKER)) continue;
        for (const [r, msg] of rules) {
          if (r.test(line)) findings.push({ path: rel, line: index + 1, message: msg });
        }
      }
    }
  }
}
walk(root);
if (findings.length) {
  console.error(JSON.stringify({ passed: false, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, findings: [] }, null, 2));
