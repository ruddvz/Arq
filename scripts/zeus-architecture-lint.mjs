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
    // Requires an assertive copula between the two halves. Without it, the correct
    // sentence "renderer objects are disposable projections of canonical model data"
    // matched, because `.*` spanned the clause that made it correct.
    /renderer\s+(?:object|mesh)\w*\s+(?:is|are|becomes?|remains?|serves?\s+as|acts?\s+as)\s+(?:the\s+)?(?:canonical|authoritative)\s+(?:model|data|state|record)/i,
    'renderer objects must not be canonical model data',
  ],
  [
    /AI\s+(?:directly|silently)\s+(?:mutates|edits|writes).*canonical/i,
    'AI must propose validated typed operations',
  ],
  [/invalid\s+operation.*partial(?:ly)?\s+commit/i, 'invalid operations must be atomic'],
];

/*
 * This lint matches text, so it cannot see intent. Stating a prohibition and
 * breaching it look identical to a regex over a whole file, which is why the
 * correct sentence "an invalid operation is rejected whole, there is no partial
 * commit" used to fail.
 *
 * Two corrections keep it usable without weakening it:
 *   1. Match per sentence, so a prohibition and its subject cannot be joined
 *      across unrelated sentences by a `.*`.
 *   2. Skip a sentence that denies or prohibits the pattern it contains.
 *
 * The negation set is deliberately narrow. "without" is excluded: "the AI
 * directly mutates canonical project state without review" is a breach, not a
 * denial, and an over-broad set would exempt it.
 */
const NEGATION =
  /\b(?:not|never|no|cannot|can't|won't|prohibit(?:ed|s)?|forbidden|reject(?:ed|s)?|disallow(?:ed|s)?|banned|instead\s+of|rather\s+than)\b/i;

const sentences = (text) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

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
      const seen = new Set();
      for (const sentence of sentences(text)) {
        if (NEGATION.test(sentence)) continue;
        for (const [pattern, message] of rules) {
          if (seen.has(message) || !pattern.test(sentence)) continue;
          seen.add(message);
          findings.push({ path: rel, message, sentence: sentence.slice(0, 160) });
        }
      }
    }
  }
}
walk(root);

if (findings.length) {
  for (const item of findings) {
    console.error(`${item.path}: ${item.message}`);
    console.error(`  ${item.sentence}`);
  }
  console.error(`Architecture lint failed with ${findings.length} finding(s).`);
  process.exit(1);
}
console.log('Architecture lint passed.');
