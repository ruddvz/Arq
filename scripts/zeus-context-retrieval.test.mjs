import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(repoRoot, 'scripts', 'zeus-context.mjs');

function write(root, rel, content) {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function run(root, cache, ...args) {
  const result = spawnSync(
    process.execPath,
    [script, '--root', root, '--cache', cache, ...args],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(path.join(os.tmpdir(), 'zeus-context-retrieval-'));
const cache = path.join(root, 'project-index.json');
const filler = Array.from(
  { length: 90 },
  (_, i) => `// filler ${String(i + 1).padStart(3, '0')} abcdefghijklmnopqrstuvwxyz`,
).join('\n');
write(
  root,
  'src/wall.ts',
  `# Heading one\n# Heading two\n# Heading three\n# Heading four\n# Heading five\n${filler}\n// precisiontarget wall snapping evidence lives here\n`,
);
write(
  root,
  'docs/ARQ_V13_IMPLEMENTATION_LEDGER.md',
  '# Legacy ledger\nlegacytoken implementation ledger historical evidence\n',
);
for (let i = 0; i < 6; i += 1) {
  write(root, `src/wall-${i}.ts`, `export const wall${i} = ${i};\n`);
}

const files = [
  {
    path: 'src/wall.ts',
    headings: [
      'Heading one',
      'Heading two',
      'Heading three',
      'Heading four',
      'Heading five',
    ],
    keywords: ['wall', 'precisiontarget'],
  },
  {
    path: 'docs/ARQ_V13_IMPLEMENTATION_LEDGER.md',
    headings: ['Legacy ledger'],
    keywords: ['legacytoken', 'implementation', 'ledger'],
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    path: `src/wall-${i}.ts`,
    headings: [],
    keywords: ['wall'],
  })),
];
writeFileSync(cache, `${JSON.stringify({ fingerprint: 'fixture', files }, null, 2)}\n`);

{
  const result = run(root, cache, '--query', 'wall precisiontarget', '--snippets');
  const wall = result.results.find((item) => item.path === 'src/wall.ts');
  assert(wall, 'expected wall source in context results');
  assert.match(wall.snippet, /precisiontarget/);
  assert(
    wall.snippetStart > 0,
    'expected query-centred snippet instead of file prefix',
  );
  assert(wall.headings.length <= 4, 'expected bounded heading output');
  assert(result.usedContextChars <= result.budget.contextChars);
}

{
  const result = run(root, cache, '--query', 'legacytoken implementation ledger', '--snippets');
  assert.equal(
    result.results.some((item) => item.path.includes('IMPLEMENTATION_LEDGER')),
    false,
  );
  assert.equal(result.coldSourcesExcluded, 1);
}

{
  const result = run(
    root,
    cache,
    '--query',
    'legacytoken implementation ledger',
    '--snippets',
    '--include-cold',
  );
  assert.equal(
    result.results.some((item) => item.path.includes('IMPLEMENTATION_LEDGER')),
    true,
  );
  assert.equal(result.coldSourcesExcluded, 0);
}

{
  const result = run(root, cache, '--query', 'wall', '--limit', '999');
  assert(
    result.results.length <= 4,
    'fast retrieval must not exceed the existing source ceiling',
  );
  assert.equal(result.budget.sources, 4);
}

console.log('ZEUS context retrieval regressions passed.');
