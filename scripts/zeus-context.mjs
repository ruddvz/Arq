#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const a = process.argv.slice(2);
const val = (n, d = null) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : d;
};

const root = resolve(val('root', process.cwd()));
const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));
const config = JSON.parse(readFileSync(join(packageRoot, '.zeus', 'config.json'), 'utf8'));
const cache = resolve(val('cache', join(root, config.cache.directory, 'project-index.json')));

if (!existsSync(cache)) {
  const r = spawnSync(
    process.execPath,
    [join(packageRoot, 'scripts', 'zeus-index.mjs'), '--root', root, '--cache', cache],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
}

const idx = JSON.parse(readFileSync(cache, 'utf8'));
const query = val('query');
if (!query) {
  console.error('Use --query');
  process.exit(2);
}

const tier = val('tier', 'fast');
const budget = config.budgets[tier] ?? config.budgets.fast;
const contextConfig = config.context ?? {};
const sourceCap = Math.min(contextConfig.sourceCaps?.[tier] ?? budget.sources, budget.sources);
const requestedLimit = Number(val('limit', sourceCap));
const limit = Math.max(
  1,
  Math.min(Number.isFinite(requestedLimit) ? requestedLimit : sourceCap, sourceCap),
);
const q = [...new Set(query.toLowerCase().match(/[a-z][a-z0-9_.-]{2,}/g) ?? [])];
const includeCold = a.includes('--include-cold');
const coldHints = contextConfig.coldPathHints ?? [
  'all-contents.md',
  'implementation_ledger',
  'implementation-ledger',
  '/archive/',
  '/archives/',
  '/historical/',
  '/history/',
  'changelog',
];
const isCold = (p) => {
  const lower = `/${String(p).toLowerCase().replaceAll('\\', '/')}`;
  return coldHints.some((hint) => lower.includes(String(hint).toLowerCase()));
};
const authority = (p) =>
  /^(src|packages|apps)\//.test(p)
    ? 8
    : /adr|decision|file-system|schema|contract/i.test(p)
      ? 10
      : /readme|start-here/i.test(p)
        ? 6
        : 0;

const scoredAll = idx.files.map((f) => {
  const hay = (f.path + ' ' + f.headings.join(' ') + ' ' + f.keywords.join(' ')).toLowerCase();
  let score = authority(f.path);
  for (const t of q) {
    if (f.path.toLowerCase().includes(t)) score += 8;
    if (hay.includes(t)) score += 2;
  }
  return { ...f, score };
});
const coldSourcesExcluded = includeCold
  ? 0
  : scoredAll.filter((f) => f.score > 0 && isCold(f.path)).length;
const scored = scoredAll
  .filter((f) => f.score > 0)
  .filter((f) => includeCold || !isCold(f.path))
  .sort((x, y) => y.score - x.score || x.path.localeCompare(y.path))
  .slice(0, limit);

const relevantSnippet = (text, terms, cap) => {
  if (cap <= 0) return { text: '', start: 0 };
  if (text.length <= cap) return { text, start: 0 };
  const lower = text.toLowerCase();
  const candidates = [];
  for (const term of terms) {
    let from = 0;
    for (let hits = 0; hits < 8; hits += 1) {
      const at = lower.indexOf(term, from);
      if (at < 0) break;
      candidates.push(at);
      from = at + Math.max(1, term.length);
    }
  }
  if (candidates.length === 0) return { text: text.slice(0, cap), start: 0 };

  let bestAt = candidates[0];
  let bestScore = -1;
  for (const at of candidates) {
    const start = Math.max(0, at - Math.floor(cap * 0.35));
    const window = lower.slice(start, Math.min(lower.length, start + cap));
    const score = terms.reduce((sum, term) => sum + (window.includes(term) ? 1 : 0), 0);
    if (score > bestScore || (score === bestScore && at < bestAt)) {
      bestScore = score;
      bestAt = at;
    }
  }

  let start = Math.max(0, bestAt - Math.floor(cap * 0.35));
  const nearbyHeading = text.lastIndexOf('\n#', bestAt);
  if (nearbyHeading >= start && bestAt - nearbyHeading <= Math.floor(cap * 0.45)) {
    start = nearbyHeading + 1;
  } else if (start > 0) {
    const lineStart = text.lastIndexOf('\n', start);
    if (lineStart >= 0) start = lineStart + 1;
  }
  if (start + cap > text.length) start = Math.max(0, text.length - cap);
  return { text: text.slice(start, start + cap).trimEnd(), start };
};

let used = 0;
const results = [];
for (const f of scored) {
  const item = {
    path: f.path,
    score: f.score,
    headings: f.headings.slice(0, contextConfig.maxReturnedHeadings ?? 4),
  };
  if (a.includes('--snippets')) {
    const remaining = budget.contextChars - used;
    if (remaining <= 0) break;
    try {
      const body = readFileSync(join(root, f.path), 'utf8');
      const snippet = relevantSnippet(
        body,
        q,
        Math.min(contextConfig.snippetChars ?? 1200, remaining),
      );
      item.snippet = snippet.text;
      item.snippetStart = snippet.start;
      used += snippet.text.length;
    } catch {}
  }
  results.push(item);
}

console.log(
  JSON.stringify(
    {
      query,
      tier,
      budget: { sources: limit, contextChars: budget.contextChars },
      usedContextChars: used,
      coldSourcesExcluded,
      fingerprint: idx.fingerprint,
      results,
    },
    null,
    2,
  ),
);
