#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.argv[2] ?? process.cwd();
if (!existsSync(root)) {
  console.error(`Path does not exist: ${root}`);
  process.exit(2);
}

const ignored = [
  /node_modules/,
  /\.git/,
  /archive/i,
  /historical/i,
  /PACK-MANIFEST/,
  /REFERENCE-SYSTEM-CRITIQUE/,
  /quality\/architecture-bad/,
  /quality\/fixtures/,
  /scripts\/zeus-architecture-lint\.mjs$/,
  /scripts\/zeus-verify\.mjs$/,
];
const extensions = new Set([
  '.md',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.sql',
  '.rs',
  '.py',
  '.yml',
  '.yaml',
  '.sh',
]);
const rules = [
  [
    /Dexie\s+(?:is|as)\s+(?:the\s+)?(?:canonical|authoritative).*project/i,
    'Dexie/IndexedDB must not be canonical project storage',
  ],
  [
    /IndexedDB\s+(?:is|as)\s+(?:the\s+)?(?:canonical|authoritative).*project/i,
    'IndexedDB must not be canonical project storage',
  ],
  [/\.arq\s+is\s+(?:a\s+)?(?:zip|json archive)/i, '.arq must not be defined as a ZIP/JSON archive'],
  [/(?:sync|replicate)\s+raw\s+SQLite\s+pages/i, 'raw SQLite page sync is prohibited'],
  [
    /renderer\s+(?:object|mesh).*canonical\s+(?:model|data)/i,
    'renderer objects must not be canonical model data',
  ],
  [
    /AI\s+(?:directly|silently)\s+(?:mutates|edits|writes).*canonical/i,
    'AI must propose validated typed operations',
  ],
  [/invalid\s+operation.*partial(?:ly)?\s+commit/i, 'invalid operations must be atomic'],
];

const findings = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(root, path);
    if (ignored.some((pattern) => pattern.test(rel))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (extensions.has(extname(path).toLowerCase()) && stat.size < 2_000_000) {
      const text = readFileSync(path, 'utf8');
      for (const [pattern, message] of rules) {
        if (pattern.test(text)) findings.push({ path: rel, message });
      }
    }
  }
}
walk(root);

if (findings.length) {
  for (const item of findings) console.error(`${item.path}: ${item.message}`);
  console.error(`Architecture lint failed with ${findings.length} finding(s).`);
  process.exit(1);
}
console.log('Architecture lint passed.');
