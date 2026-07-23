#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, join, relative, extname, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const val = (n) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : null;
};
const root = resolve(val('root') ?? process.cwd());
const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));
const config = JSON.parse(readFileSync(join(packageRoot, '.zeus', 'config.json'), 'utf8'));
const cache = resolve(val('cache') ?? join(root, config.cache.directory, 'project-index.json'));
const lock = cache + '.lock';
mkdirSync(dirname(cache), { recursive: true });
const fp = spawnSync(
  process.execPath,
  [join(packageRoot, 'scripts', 'zeus-fingerprint.mjs'), '--root', root],
  { encoding: 'utf8' },
);
if (fp.status !== 0) {
  process.stderr.write(fp.stderr);
  process.exit(1);
}
const fingerprint = JSON.parse(fp.stdout).fingerprint;
if (!a.includes('--force') && existsSync(cache)) {
  try {
    const old = JSON.parse(readFileSync(cache, 'utf8'));
    if (old.fingerprint === fingerprint) {
      console.log(
        JSON.stringify({ status: 'hit', cache, files: old.files.length, fingerprint }, null, 2),
      );
      process.exit(0);
    }
  } catch {}
}
let locked = false;
try {
  const fd = openSync(lock, 'wx');
  closeSync(fd);
  locked = true;
} catch {
  try {
    const age = Date.now() - statSync(lock).mtimeMs;
    if (age > config.cache.lockStaleSeconds * 1000) {
      unlinkSync(lock);
      const fd = openSync(lock, 'wx');
      closeSync(fd);
      locked = true;
    } else {
      console.error(
        JSON.stringify({ status: 'blocked', reason: 'index lock active', lock }, null, 2),
      );
      process.exit(3);
    }
  } catch {}
}
const excludedNames = new Set(config.index.exclude.filter((e) => !e.includes('/')));
const excludedPaths = config.index.exclude.filter((e) => e.includes('/'));
const isExcluded = (relPath, name) =>
  excludedNames.has(name) ||
  excludedPaths.some((e) => relPath === e || relPath.startsWith(e + '/'));
const textExt = new Set([
  '.md',
  '.txt',
  '.json',
  '.jsonc',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.rs',
  '.toml',
  '.yaml',
  '.yml',
  '.css',
  '.scss',
  '.html',
  '.sql',
  '.py',
  '.sh',
]);
const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    const relPath = relative(root, p).replaceAll('\\', '/');
    if (isExcluded(relPath, name)) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p);
    else if (
      st.isFile() &&
      st.size <= config.index.maxFileBytes &&
      textExt.has(extname(name).toLowerCase())
    ) {
      let text = '';
      try {
        text = readFileSync(p, 'utf8').slice(0, config.index.sampleChars);
      } catch {
        continue;
      }
      const headings = [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].slice(0, 12).map((m) => m[1].trim());
      const words =
        (relPath + ' ' + headings.join(' ') + ' ' + text)
          .toLowerCase()
          .match(/[a-z][a-z0-9_.-]{2,}/g) ?? [];
      const freq = {};
      for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
      const keywords = Object.entries(freq)
        .sort((x, y) => y[1] - x[1])
        .slice(0, config.index.maxKeywords)
        .map((x) => x[0]);
      files.push({
        path: relPath,
        size: st.size,
        mtimeMs: Math.trunc(st.mtimeMs),
        hash: createHash('sha1').update(text).digest('hex'),
        headings,
        keywords,
      });
    }
  }
};
try {
  walk(root);
  files.sort((x, y) => x.path.localeCompare(y.path));
  const out = { version: 1, root, fingerprint, createdAt: new Date().toISOString(), files };
  const tmp = cache + '.tmp-' + process.pid;
  writeFileSync(tmp, JSON.stringify(out));
  renameSync(tmp, cache);
  console.log(
    JSON.stringify({ status: 'built', cache, files: files.length, fingerprint }, null, 2),
  );
} finally {
  if (locked) {
    try {
      unlinkSync(lock);
    } catch {}
  }
}
