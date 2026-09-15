import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHELL_STATE_KINDS, resolveShellStateSemantics } from './shell-state';

const WORKSPACE_ROOT = fileURLToPath(new URL('./', import.meta.url));
const SOURCE = readFileSync(`${WORKSPACE_ROOT}shell-state.tsx`, 'utf8');
const CSS = readFileSync(`${WORKSPACE_ROOT}shell-state.css`, 'utf8');
const SHELL_CONTROLS = readFileSync(
  new URL('../shell/shell-controls.css', import.meta.url),
  'utf8',
);

describe('ShellState contract', () => {
  it('covers the complete package-level shell state matrix', () => {
    expect(SHELL_STATE_KINDS).toEqual([
      'empty',
      'loading',
      'unavailable',
      'read-only',
      'recoverable-error',
      'failure',
      'empty-panel',
    ]);
  });

  it('keeps static empty and restricted states out of live regions by default', () => {
    expect(resolveShellStateSemantics('empty')).toEqual({ role: 'group' });
    expect(resolveShellStateSemantics('unavailable')).toEqual({ role: 'group' });
    expect(resolveShellStateSemantics('read-only')).toEqual({ role: 'group' });
    expect(resolveShellStateSemantics('empty-panel')).toEqual({ role: 'group' });
  });

  it('announces loading and recoverable errors politely and surface failure assertively', () => {
    expect(resolveShellStateSemantics('loading')).toEqual({
      role: 'status',
      live: 'polite',
      atomic: true,
    });
    expect(resolveShellStateSemantics('recoverable-error')).toEqual({
      role: 'status',
      live: 'polite',
      atomic: true,
    });
    expect(resolveShellStateSemantics('failure')).toEqual({
      role: 'alert',
      live: 'assertive',
      atomic: true,
    });
  });

  it('allows authoritative callers to override announcement behaviour explicitly', () => {
    expect(resolveShellStateSemantics('loading', 'off')).toEqual({ role: 'group' });
    expect(resolveShellStateSemantics('empty', 'polite')).toEqual({
      role: 'status',
      live: 'polite',
      atomic: true,
    });
    expect(resolveShellStateSemantics('read-only', 'assertive')).toEqual({
      role: 'alert',
      live: 'assertive',
      atomic: true,
    });
  });

  it('keeps public copy string-only and exposes no raw exception or diagnostics prop', () => {
    expect(SOURCE).toMatch(/readonly title: string;/);
    expect(SOURCE).toMatch(/readonly description\??: string;/);
    expect(SOURCE).not.toMatch(
      /readonly (?:error|exception|stack|diagnostics?|filePath)\??\s*:/i,
    );
    expect(SOURCE).not.toMatch(/\.stack\b/);
  });

  it('requires visible explanatory copy for unavailable and read-only states', () => {
    expect(SOURCE).toMatch(
      /readonly kind: 'unavailable' \| 'read-only';[\s\S]*readonly description: string;/,
    );
    expect(SOURCE).toMatch(
      /readonly kind: Exclude<ShellStateKind, 'unavailable' \| 'read-only'>;[\s\S]*readonly description\?: string;/,
    );
    expect(SOURCE).toMatch(
      /description === undefined \? null : \([\s\S]*<p id=\{descriptionId\}[\s\S]*\{description\}[\s\S]*<\/p>/,
    );
    expect(SOURCE).not.toMatch(/title=\{description\}/);
  });

  it('supports empty states without forcing an action and recoverable states with supplied actions', () => {
    expect(SOURCE).toContain('readonly primaryAction?: ShellStateAction;');
    expect(SOURCE).toContain('readonly secondaryAction?: ShellStateAction;');
    expect(SOURCE).toContain(
      'primaryAction === undefined && secondaryAction === undefined ? null',
    );
    expect(resolveShellStateSemantics('recoverable-error').role).toBe('status');
  });

  it('uses native button and link controls so supplied actions keep keyboard semantics', () => {
    expect(SOURCE).toMatch(/<a[\s\S]*className=\{className\}[\s\S]*href=\{action\.href\}/);
    expect(SOURCE).toMatch(/<button[\s\S]*className=\{className\}[\s\S]*type="button"/);
    expect(CSS).toContain("@import '../shell/shell-controls.css';");
    expect(SHELL_CONTROLS).toMatch(/\.arq-shell-button:focus-visible\s*\{/);
  });

  it('reuses the canonical disabled-reason contract for reasoned actions', () => {
    expect(SOURCE).toContain('readonly disabledReason?: string;');
    expect(SOURCE).toContain('describeDisabledState');
    expect(SOURCE).toContain('shouldIgnoreActivation');
    expect(SOURCE).toContain("'aria-disabled': disabledState.attributes['aria-disabled']");
    expect(SOURCE).toContain("'aria-describedby': disabledState.attributes['aria-describedby']");
    expect(SOURCE).toContain('event.preventDefault();');
    expect(SOURCE).toContain('a disabled shell-state action must provide a visible reason');
  });

  it('renders disabled-action reasons visibly instead of relying on hover', () => {
    expect(SOURCE).toContain('className="arq-shell-state__action-reason"');
    expect(SOURCE).toContain('{disabledState.reasonText}');
    expect(CSS).toMatch(/\.arq-shell-state__action-reason\s*\{/);
    expect(SOURCE).not.toMatch(/title=\{disabledState\.reasonText\}/);
  });

  it('connects accessible title/description and busy state to the state container', () => {
    expect(SOURCE).toContain('aria-labelledby={titleId}');
    expect(SOURCE).toContain('aria-describedby={descriptionId}');
    expect(SOURCE).toContain("aria-busy={kind === 'loading' ? true : undefined}");
    expect(SOURCE).toContain('role={semantics.role}');
    expect(SOURCE).toContain('aria-live={semantics.live}');
    expect(SOURCE).toContain('aria-atomic={semantics.atomic}');
  });

  it('keeps state truth caller-supplied with no persistence or permission authority import', () => {
    expect(SOURCE).toContain("from '../interaction-foundation/interaction';");
    expect(SOURCE).not.toMatch(/from ['"]@arq\//);
    expect(SOURCE).not.toMatch(
      /readonly (?:saved|recovered|writable|permission|durability)\??\s*:/i,
    );
  });

  it('supports long copy and narrow containers without clipping', () => {
    expect(CSS).toMatch(/\.arq-shell-state\s*\{[\s\S]*min-inline-size:\s*0;/);
    expect(CSS).toMatch(/\.arq-shell-state__content\s*\{[\s\S]*min-inline-size:\s*0;/);
    expect(CSS).toMatch(/\.arq-shell-state__title\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(CSS).toMatch(
      /\.arq-shell-state__description\s*\{[\s\S]*overflow-wrap:\s*anywhere;/,
    );
    expect(CSS).toMatch(
      /\.arq-shell-state__actions \.arq-shell-button\s*\{[\s\S]*white-space:\s*normal;/,
    );
    expect(CSS).toMatch(
      /\.arq-shell-state__action-reason\s*\{[\s\S]*overflow-wrap:\s*anywhere;/,
    );
  });

  it('gives empty panels a compact presentation without creating another panel authority', () => {
    expect(SOURCE).toContain(
      "kind === 'empty-panel' ? 'arq-shell-state arq-shell-state--panel' : 'arq-shell-state'",
    );
    expect(CSS).toMatch(
      /\.arq-shell-state--panel\s*\{[\s\S]*padding:\s*var\(--arq-space-panel\);/,
    );
    expect(CSS).not.toMatch(/z-index\s*:/);
  });

  it('uses existing tokens and textual content rather than a colour-only state vocabulary', () => {
    expect(SOURCE).toMatch(/readonly title: string;/);
    expect(SOURCE).toContain('<h2 id={titleId} className="arq-shell-state__title">');
    expect(SOURCE).toContain('readonly icon?: ReactNode;');
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CSS).not.toMatch(/\brgba?\(/i);
    expect(CSS).not.toMatch(/\bhsla?\(/i);
    expect(CSS).not.toMatch(/box-shadow\s*:/);
    expect(CSS).not.toMatch(/border-radius\s*:/);
  });
});
