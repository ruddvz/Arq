#!/usr/bin/env node
/**
 * Editor dependency boundary check (ARQ Interaction Foundation 1.0).
 *
 * Enforces quality/editor-dependency-boundaries.json: named rules, each with
 * a reason, path scopes and forbidden packages. A violation is either a
 * source import (static, dynamic or require) or a package.json dependency
 * declaration of a forbidden package inside a scoped path. Rule-driven
 * rather than a hard-coded grep so later boundaries (renderer-only,
 * server-only, package ownership) are new rules in the same file, not a new
 * script.
 *
 * Exit 1 with every violation listed; exit 0 with a per-rule summary.
 * Run via `pnpm check:editor-dependency-boundaries` (wired into CI's
 * lint-and-typecheck job).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rulesPath = path.join(repoRoot, 'quality', 'editor-dependency-boundaries.json');
const { rules } = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'dist-build', 'coverage', 'target']);

/** import/from '<pkg>', require('<pkg>'), import('<pkg>') - package position anchored. */
function importPattern(packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:from\\s*['"]|import\\s*\\(\\s*['"]|require\\s*\\(\\s*['"]|import\\s+['"])${escaped}(?:[/'"])`,
  );
}

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absolute);
    } else {
      yield absolute;
    }
  }
}

const violations = [];
const checkedPerRule = new Map();

for (const rule of rules) {
  let checked = 0;
  const patterns = rule.forbiddenPackages.map((name) => ({
    name,
    importRe: importPattern(name),
  }));
  for (const scope of rule.scopes) {
    const scopeRoot = path.join(repoRoot, scope);
    if (!fs.existsSync(scopeRoot)) continue;
    for (const file of walk(scopeRoot)) {
      const relative = path.relative(repoRoot, file);
      const extension = path.extname(file);
      if (path.basename(file) === 'package.json') {
        checked += 1;
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        const declared = Object.keys({
          ...manifest.dependencies,
          ...manifest.devDependencies,
          ...manifest.peerDependencies,
          ...manifest.optionalDependencies,
        });
        for (const { name } of patterns) {
          const hit = declared.find(
            (dependency) => dependency === name || dependency.startsWith(`${name}/`),
          );
          if (hit !== undefined) {
            violations.push(`${relative}: declares forbidden dependency ${hit} [${rule.id}]`);
          }
        }
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(extension)) continue;
      checked += 1;
      const text = fs.readFileSync(file, 'utf8');
      for (const { name, importRe } of patterns) {
        if (importRe.test(text)) {
          violations.push(`${relative}: imports forbidden package ${name} [${rule.id}]`);
        }
      }
    }
  }
  checkedPerRule.set(rule.id, checked);
}

if (violations.length > 0) {
  console.error('Editor dependency boundary check FAILED:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

for (const [ruleId, checked] of checkedPerRule) {
  console.log(`PASS ${ruleId} (${checked} files checked)`);
}
console.log('Editor dependency boundaries hold.');
