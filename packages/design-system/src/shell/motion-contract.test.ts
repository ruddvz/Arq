import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SHELL_ROOT = new URL('./', import.meta.url);
const SHELL_TOKENS = readFileSync(new URL('./shell-tokens.css', SHELL_ROOT), 'utf8');
const SHELL_CONTROLS = readFileSync(new URL('./shell-controls.css', SHELL_ROOT), 'utf8');
const MODAL_DIALOG = readFileSync(new URL('./modal-dialog.css', SHELL_ROOT), 'utf8');
const WORKSPACE_SHELL = readFileSync(new URL('../workspace/workspace-shell.css', SHELL_ROOT), 'utf8');

const CANONICAL_DURATIONS = [
  '--arq-motion-instant',
  '--arq-motion-micro',
  '--arq-motion-fast',
  '--arq-motion-normal',
  '--arq-motion-deliberate',
] as const;

describe('shell motion contract', () => {
  it('keeps one canonical shell duration vocabulary', () => {
    for (const token of CANONICAL_DURATIONS) {
      expect(SHELL_TOKENS).toContain(`${token}:`);
    }
    expect(SHELL_TOKENS).toContain('--arq-ease-standard:');
    expect(SHELL_TOKENS).toContain('--arq-ease-enter:');
    expect(SHELL_TOKENS).toContain('--arq-ease-exit:');
  });

  it('bridges legacy workspace names directly to canonical tokens', () => {
    expect(SHELL_CONTROLS).toContain(
      '--arq-motion-duration-fast: var(--arq-motion-fast);',
    );
    expect(SHELL_CONTROLS).toContain(
      '--arq-motion-ease-standard: var(--arq-ease-standard);',
    );

    // #403 identified this existing declaration. Until the large workspace
    // stylesheet is migrated directly, it must resolve through the bridge and
    // never through its literal 160ms/ease fallbacks.
    expect(WORKSPACE_SHELL).toContain('var(--arq-motion-duration-fast, 160ms)');
    expect(WORKSPACE_SHELL).toContain('var(--arq-motion-ease-standard, ease)');
  });

  it('makes shared shell durations effectively immediate for reduced motion', () => {
    const reducedMotion = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
      SHELL_CONTROLS,
    )?.[1];

    expect(reducedMotion).toBeDefined();
    expect(reducedMotion).toContain('--arq-motion-micro: 1ms;');
    expect(reducedMotion).toContain('--arq-motion-fast: 1ms;');
    expect(reducedMotion).toContain('--arq-motion-normal: 1ms;');
    expect(reducedMotion).toContain('--arq-motion-deliberate: 1ms;');
  });

  it('removes ornamental modal and refraction movement under reduced motion', () => {
    expect(MODAL_DIALOG).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.arq-modal-backdrop[\s\S]*animation:\s*none;/,
    );
    expect(WORKSPACE_SHELL).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.arq-refraction-lens__slot[\s\S]*transition:\s*none;/,
    );
  });
});
