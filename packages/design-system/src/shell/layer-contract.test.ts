import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));
const AUDITED_ROOTS = [
  resolve(SRC_ROOT, 'shell'),
  resolve(SRC_ROOT, 'workspace'),
] as const;
const RAW_LAYER = /\b(z-index|zIndex)\s*:\s*(\d+)\b/g;

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

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function rawLayerConstants(): readonly string[] {
  const matches: string[] = [];

  for (const root of AUDITED_ROOTS) {
    for (const path of sourceFiles(root)) {
      const source = withoutComments(readFileSync(path, 'utf8'));
      for (const match of source.matchAll(RAW_LAYER)) {
        matches.push(`${relative(SRC_ROOT, path)}:${match[1]}=${match[2]}`);
      }
    }
  }

  return matches.sort();
}

/**
 * This is deliberately an audit allowlist, not an approval list.
 *
 * A new raw shell/workspace layer constant must be classified under #403/#412
 * instead of silently joining the stack. Existing entries stay visible here
 * until their owning issue migrates or removes them. Renderer/geometry values
 * are outside this narrowly scoped check.
 */
const AUDITED_RAW_LAYER_CONSTANTS = [
  'shell/ipad-landscape-shell.tsx:zIndex=1',
  'shell/ipad-landscape-shell.tsx:zIndex=1',
  'shell/ipad-landscape-shell.tsx:zIndex=1',
  'workspace/phone-project-bar.tsx:zIndex=6',
  'workspace/tab-context-menu.tsx:zIndex=6',
  'workspace/workspace-sheet.tsx:zIndex=5',
  'workspace/workspace-shell.css:z-index=1',
  'workspace/workspace-shell.css:z-index=20',
].sort();

describe('shell layer contract', () => {
  it('does not introduce unclassified raw z-index constants', () => {
    expect(rawLayerConstants()).toEqual(AUDITED_RAW_LAYER_CONSTANTS);
  });
});
