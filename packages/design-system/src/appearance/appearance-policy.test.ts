import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_POLICY,
  appearanceFeatureBlockedReason,
  appearanceFeatureIsAccepted,
} from './appearance-policy';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Where appearance can actually be expressed: the design system's own sources,
 * the one app that renders a workspace, and the shared token files. A guard
 * that scanned the whole repository would also read the retained design
 * packages under `docs/`, which are research and are supposed to describe
 * things this policy has not accepted.
 */
const SCANNED_ROOTS = ['packages/design-system/src', 'apps/web/src', 'design/tokens'] as const;

const STYLE_EXTENSIONS = ['.css', '.ts', '.tsx'];

const MATERIAL_CSS = 'packages/design-system/src/appearance/material.css';

function sourceFiles(): readonly { readonly path: string; readonly text: string }[] {
  const files: { path: string; text: string }[] = [];

  const walk = (absolute: string, relative: string): void => {
    for (const entry of readdirSync(absolute)) {
      const childAbsolute = join(absolute, entry);
      const childRelative = `${relative}/${entry}`;
      if (statSync(childAbsolute).isDirectory()) {
        walk(childAbsolute, childRelative);
        continue;
      }
      // This guard's own source names the governed constructs in prose, and a
      // scanner that matched its own documentation would never be right.
      if (childRelative.includes('appearance-policy')) {
        continue;
      }
      if (STYLE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        files.push({ path: childRelative, text: readFileSync(childAbsolute, 'utf8') });
      }
    }
  };

  for (const root of SCANNED_ROOTS) {
    walk(join(REPO_ROOT, root), root);
  }
  return files;
}

function materialCss(): string {
  return readFileSync(join(REPO_ROOT, MATERIAL_CSS), 'utf8');
}

describe('appearance policy', () => {
  it('records each feature against the ADR that decided it', () => {
    for (const feature of ['translucent-material', 'dark-appearance'] as const) {
      expect(APPEARANCE_POLICY[feature].governedBy).toMatch(/ADR-003[12]/);
      expect(APPEARANCE_POLICY[feature].decisionNeeded).toContain('ADR');
    }
  });

  it('reports no blocking reason for an accepted feature', () => {
    for (const feature of ['translucent-material', 'dark-appearance'] as const) {
      const reason = appearanceFeatureBlockedReason(feature);
      // The paired assertion: whichever way `accepted` is set, the two
      // functions agree, so a half-applied decision cannot pass.
      expect(appearanceFeatureIsAccepted(feature)).toBe(reason === null);
    }
  });
});

describe('ADR-0031: the material layer has exactly one implementation', () => {
  it('declares backdrop-filter in material.css and nowhere else', () => {
    const declaring = sourceFiles()
      .filter(({ text }) => /(?:-webkit-)?backdrop-?[fF]ilter\s*:/.test(text))
      .map(({ path }) => path);

    if (!appearanceFeatureIsAccepted('translucent-material')) {
      expect(declaring, appearanceFeatureBlockedReason('translucent-material') ?? '').toEqual([]);
      return;
    }

    /*
     * A second material system is the defect ADR-0031 names explicitly, and it
     * arrives as one more file quietly declaring its own blur. The list is
     * exact for that reason: adding to it has to be a decision.
     *
     * `refraction-lens.tsx` is on it, and is the only thing that ever should
     * be. Its filter is `url(#id)` where the id is generated per instance, so
     * it cannot be written in a stylesheet at all - and it is not a second
     * material either way: it is the same layer's third visual class, sitting
     * on a surface `material.css` already made.
     */
    expect(declaring).toEqual([
      MATERIAL_CSS,
      'packages/design-system/src/appearance/refraction-lens.tsx',
    ]);
  });

  it('renders a nested material surface flat', () => {
    // Depth stops carrying meaning the moment it repeats. Expressed as a
    // descendant selector so a nested surface cannot forget to ask.
    expect(materialCss()).toMatch(/\.arq-material\s+\.arq-material\s*\{/);
  });

  it('supplies a regular and a strong variant, and no clear variant', () => {
    const css = materialCss();

    expect(css).toMatch(/\.arq-material--strong\s*\{/);
    // The design package defines a `clear` variant and then disallows it by
    // default. A variant that exists in CSS is one somebody will reach for, so
    // it must not exist at all.
    expect(css).not.toMatch(/\.arq-material--clear/);
  });

  it('reserves the strong variant for the large presentations', () => {
    // Roles from the package's glass-materials contract: inspector, open
    // project and recovery. Applying it everywhere would make it meaningless
    // and double the blurred area for nothing.
    const strongUsers = sourceFiles()
      .filter(({ path, text }) => path.endsWith('.tsx') && text.includes('arq-material--strong'))
      .map(({ path }) => path);

    expect(strongUsers.sort()).toEqual([
      'packages/design-system/src/shell/modal-dialog.tsx',
      'packages/design-system/src/workspace/workspace-root.tsx',
    ]);
  });

  it('supplies all four opaque fallbacks', () => {
    const css = materialCss();

    for (const condition of [
      'prefers-reduced-transparency: reduce',
      'prefers-contrast: more',
      'forced-colors: active',
    ]) {
      expect(css, `missing fallback for ${condition}`).toContain(condition);
    }
    // The browser that has no backdrop-filter at all would otherwise render the
    // tint alone: a translucent surface with nothing resolved behind it.
    expect(css).toMatch(/@supports not \(/);
  });

  it('keeps material off the drawing surfaces', () => {
    // ADR-0031's first condition. Model content is never translucent and never
    // sits behind a blur it owns.
    const contentSurfaces = ['apps/web/src/PlanCanvas.tsx', 'apps/web/src/ModelCanvas.tsx'];

    for (const path of contentSurfaces) {
      expect(readFileSync(join(REPO_ROOT, path), 'utf8')).not.toContain('arq-material');
    }
  });

  it('applies material to the floating control surfaces that carry it', () => {
    // The complement of the test above: if the class were dropped everywhere,
    // every other assertion here would still pass and the layer would be gone.
    const wearing = sourceFiles()
      .filter(({ path, text }) => path.endsWith('.tsx') && text.includes('arq-material'))
      .map(({ path }) => path);

    /*
     * An allow-list, so a surface cannot start wearing the material without
     * somebody deciding it should. The five added for Optical Glass 2.0 are the
     * package's own first case - bounded navigation shells, floating tool
     * groups and compact overlays - and every one of them floats over the
     * canvas, which is the condition ADR-0031 sets.
     *
     * `App.tsx` is on it for the drawing's own corner chrome, the title and the
     * view controls. It is not on it for the canvas: the test below keeps
     * material off `PlanCanvas` and `ModelCanvas`, which is where model content
     * lives.
     */
    expect(wearing.sort()).toEqual([
      'apps/web/src/App.tsx',
      'packages/design-system/src/interaction-foundation/feedback/command-feedback.tsx',
      'packages/design-system/src/interaction-foundation/overlays/context-hud.tsx',
      'packages/design-system/src/shell/modal-dialog.tsx',
      'packages/design-system/src/shell/status-bar.tsx',
      'packages/design-system/src/shell/top-bar.tsx',
      'packages/design-system/src/workspace/view-kind-switcher.tsx',
      'packages/design-system/src/workspace/workspace-root.tsx',
    ]);
  });

  it('gives the optical variant every fallback the regular one has', () => {
    const css = materialCss();

    expect(css).toMatch(/\.arq-material--optical\s*\{/);
    /*
     * The variant is a second set of values on the same layer, not a second
     * layer - so it has to carry the same four escapes. A translucent surface
     * that stays translucent under forced colours or reduced transparency is
     * the defect the fallbacks exist to prevent, and adding a variant is
     * exactly when one gets forgotten.
     */
    const opticalRules = css.match(/\.arq-material--optical[^{]*\{[^}]*\}/g) ?? [];
    expect(opticalRules.length).toBeGreaterThanOrEqual(5);
    for (const condition of [
      'prefers-reduced-transparency: reduce',
      'prefers-contrast: more',
      'forced-colors: active',
    ]) {
      const block = new RegExp(
        `@media[^{]*${condition.replace(/[()]/g, '\\$&')}[^{]*\\{[\\s\\S]*?\\.arq-material--optical`,
      );
      expect(css, `optical variant has no fallback for ${condition}`).toMatch(block);
    }
  });

  it('leaves the full-viewport modal backdrop a plain scrim', () => {
    // ADR-0031 bounds material to discrete surfaces. The backdrop covers the
    // whole viewport, which is the one place the GPU cost would be unbounded.
    const modal = readFileSync(
      join(REPO_ROOT, 'packages/design-system/src/shell/modal-dialog.css'),
      'utf8',
    );
    const backdropRule = /\.arq-modal-overlay\s*\{([^}]*)\}/.exec(modal);

    expect(backdropRule).not.toBeNull();
    expect(backdropRule?.[1]).not.toContain('backdrop-filter');
  });
});

describe('ADR-0032: the dark appearance is declared', () => {
  /**
   * The `--arq-ui-*` set is the UI chrome palette - paper, surfaces, lines and
   * text. A dark appearance is exactly a redefinition of those under a
   * `prefers-color-scheme: dark` query, so that is what this looks for.
   */
  function darkBlocks(text: string): readonly string[] {
    const blocks: string[] = [];
    const marker = /@media[^{]*prefers-color-scheme:\s*dark[^{]*\{/g;
    let match = marker.exec(text);
    while (match !== null) {
      // Walk braces from the end of the @media prelude to its matching close,
      // so a nested `:root { ... }` is captured with the block rather than
      // ending it early.
      let depth = 1;
      let index = match.index + match[0].length;
      const start = index;
      while (index < text.length && depth > 0) {
        if (text[index] === '{') depth += 1;
        else if (text[index] === '}') depth -= 1;
        index += 1;
      }
      blocks.push(text.slice(start, index - 1));
      match = marker.exec(text);
    }
    return blocks;
  }

  it('redefines the UI chrome tokens under a dark colour scheme', () => {
    const redefining = sourceFiles()
      .filter(({ text }) => darkBlocks(text).some((block) => /--arq-ui-[\w-]+\s*:/.test(block)))
      .map(({ path }) => path);

    if (!appearanceFeatureIsAccepted('dark-appearance')) {
      expect(redefining, appearanceFeatureBlockedReason('dark-appearance') ?? '').toEqual([]);
      return;
    }

    expect(redefining).toContain('packages/design-system/src/shell/shell-tokens.css');
  });

  it('reads a dark block that is present, so the parser cannot pass by finding nothing', () => {
    const brand = readFileSync(join(REPO_ROOT, 'design/tokens/brand.v4.css'), 'utf8');
    const blocks = darkBlocks(brand);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('--arq-brand-foreground');
  });
});
