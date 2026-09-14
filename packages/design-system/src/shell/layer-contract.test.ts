import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));
const AUDITED_ROOTS = [resolve(SRC_ROOT, 'shell'), resolve(SRC_ROOT, 'workspace')] as const;
const RAW_LAYER = /\b(?:z-index|zIndex)\s*:\s*(\d+)\b/g;
const SHELL_TOKENS = readFileSync(resolve(SRC_ROOT, 'shell/shell-tokens.css'), 'utf8');

function sourceFiles(root: string): readonly string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
      continue;
    }

    if (/\.(?:css|ts|tsx)$/.test(entry) && !/\.test\.(?:ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

function rawLayerValues(): readonly number[] {
  const values: number[] = [];

  for (const root of AUDITED_ROOTS) {
    for (const path of sourceFiles(root)) {
      const source = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const match of source.matchAll(RAW_LAYER)) {
        values.push(Number(match[1]));
      }
    }
  }

  return values;
}

const CANONICAL_LAYERS = [
  ['--arq-z-shell-raised', 10],
  ['--arq-z-context-hud', 90],
  ['--arq-z-workspace-overlay', 95],
  ['--arq-z-accessibility', 98],
  ['--arq-z-overlay-backdrop', 100],
  ['--arq-z-overlay-surface', 110],
  ['--arq-z-popover', 120],
  ['--arq-z-toast', 200],
] as const;

describe('shell layer contract', () => {
  it('keeps the named global layer tiers pinned and ordered', () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (const [token, value] of CANONICAL_LAYERS) {
      expect(SHELL_TOKENS).toMatch(new RegExp(`${token}\\s*:\\s*${value}\\s*;`));
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it('rejects raw shell/workspace escalation into named global tiers', () => {
    for (const value of rawLayerValues()) {
      expect(value).toBeLessThanOrEqual(20);
    }
  });
});
