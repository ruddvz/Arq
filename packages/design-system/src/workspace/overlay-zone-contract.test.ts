import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CANVAS_OVERLAY_ROLE_ZONE, CANVAS_OVERLAY_ZONES } from './canvas-overlay-zone';

const WORKSPACE_ROOT = fileURLToPath(new URL('./', import.meta.url));
const CONTRACT_CSS = readFileSync(`${WORKSPACE_ROOT}overlay-zone-contract.css`, 'utf8');
const SHELL_TOKENS = readFileSync(new URL('../shell/shell-tokens.css', import.meta.url), 'utf8');
const SHEET_SOURCE = readFileSync(new URL('./workspace-sheet.tsx', import.meta.url), 'utf8');
const TAB_MENU_SOURCE = readFileSync(new URL('./tab-context-menu.tsx', import.meta.url), 'utf8');
const PHONE_MENU_SOURCE = readFileSync(new URL('./phone-project-bar.tsx', import.meta.url), 'utf8');

function cssNumber(source: string, token: string): number {
  const match = new RegExp(`${token}\\s*:\\s*(\\d+)\\s*;`).exec(source);
  if (match === null) {
    throw new Error(`missing numeric CSS token ${token}`);
  }
  return Number(match[1]);
}

describe('workspace overlay zone contract', () => {
  it('reserves all named canvas zones and future integration roles', () => {
    expect(CANVAS_OVERLAY_ZONES).toEqual([
      'top-left',
      'top-center',
      'top-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
      'center',
      'selection',
      'tool',
    ]);
    expect(CANVAS_OVERLAY_ROLE_ZONE).toEqual({
      'view-identity': 'top-left',
      'level-selector': 'top-left',
      'view-controls': 'top-right',
      'transient-feedback': 'bottom-center',
      'ai-highlight': 'center',
      'selection-chrome': 'selection',
      'tool-hud': 'tool',
    });
  });

  it('keeps workspace overlays between the HUD and modal backdrop', () => {
    const hud = cssNumber(SHELL_TOKENS, '--arq-z-context-hud');
    const workspaceOverlay = cssNumber(CONTRACT_CSS, '--arq-z-workspace-overlay');
    const accessibility = cssNumber(CONTRACT_CSS, '--arq-z-accessibility');
    const modalBackdrop = cssNumber(SHELL_TOKENS, '--arq-z-overlay-backdrop');

    expect(hud).toBeLessThan(workspaceOverlay);
    expect(workspaceOverlay).toBeLessThan(accessibility);
    expect(accessibility).toBeLessThan(modalBackdrop);
  });

  it('keeps zone hosts pointer-transparent and control bounds interactive', () => {
    expect(CONTRACT_CSS).toMatch(/\.arq-canvas-overlay-zone\s*\{[\s\S]*pointer-events:\s*none;/);
    expect(CONTRACT_CSS).toMatch(/\.arq-canvas-overlay-control\s*\{[\s\S]*pointer-events:\s*auto;/);
  });

  it('migrates sheet and menus to named layer variables', () => {
    expect(SHEET_SOURCE).toContain("zIndex: 'var(--arq-z-workspace-overlay)'");
    expect(SHEET_SOURCE).not.toMatch(/zIndex:\s*5\b/);
    expect(TAB_MENU_SOURCE).toContain("zIndex: 'var(--arq-z-popover)'");
    expect(TAB_MENU_SOURCE).not.toMatch(/zIndex:\s*6\b/);
    expect(PHONE_MENU_SOURCE).toContain("zIndex: 'var(--arq-z-popover)'");
    expect(PHONE_MENU_SOURCE).not.toMatch(/zIndex:\s*6\b/);
  });

  it('moves floating workspace panels and the skip link onto named local tiers', () => {
    expect(CONTRACT_CSS).toMatch(
      /\.arq-workspace \.arq-workspace__overlay\s*\{[\s\S]*z-index:\s*var\(--arq-z-workspace-overlay\);/,
    );
    expect(CONTRACT_CSS).toMatch(
      /\.arq-workspace \.arq-skip-link\s*\{[\s\S]*z-index:\s*var\(--arq-z-accessibility\);/,
    );
  });
});
