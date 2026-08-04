import { describe, expect, it } from 'vitest';
import { absolutiseOpenGraph, applyBasePath, normaliseBasePath } from './build.js';
import { renderDocument } from './layout.js';
import { allPages } from './routes.js';
import type { Sbom } from './open-source-data.js';

/**
 * Subpath-hosting invariants (GitHub Pages project sites live under
 * /<repo>/): after applyBasePath, no root-absolute internal URL may remain
 * unprefixed on any page, and none may be double-prefixed.
 */

const FIXTURE_SBOM: Sbom = {
  generatedAt: '2026-07-27T00:00:00.000Z',
  packageCount: 1,
  packages: [{ name: 'example', version: '1.0.0', licence: 'MIT' }],
};

describe('normaliseBasePath', () => {
  it('treats empty, undefined and bare slash as no base', () => {
    expect(normaliseBasePath(undefined)).toBe('');
    expect(normaliseBasePath('')).toBe('');
    expect(normaliseBasePath('/')).toBe('');
  });

  it('normalises to a leading slash and no trailing slash', () => {
    expect(normaliseBasePath('Arq')).toBe('/Arq');
    expect(normaliseBasePath('/Arq')).toBe('/Arq');
    expect(normaliseBasePath('/Arq/')).toBe('/Arq');
  });
});

describe('applyBasePath', () => {
  it('is the identity with no base path', () => {
    const html = '<a href="/product">x</a>';
    expect(applyBasePath(html, '')).toBe(html);
  });

  it('prefixes href, src, srcset and content attributes', () => {
    const html =
      '<a href="/product"></a><img src="/a.png" srcset="/b.svg" /><meta content="/og.png" />';
    expect(applyBasePath(html, '/Arq')).toBe(
      '<a href="/Arq/product"></a><img src="/Arq/a.png" srcset="/Arq/b.svg" /><meta content="/Arq/og.png" />',
    );
  });

  it('leaves fragment links and non-URL content alone', () => {
    const html = '<a href="#content">skip</a><meta name="description" content="Plain text." />';
    expect(applyBasePath(html, '/Arq')).toBe(html);
  });

  it('leaves every rendered page free of unprefixed root URLs', () => {
    for (const page of allPages(FIXTURE_SBOM)) {
      const html = applyBasePath(renderDocument(page.meta, page.render()), '/Arq');
      const unprefixed = [...html.matchAll(/(?:href|src|srcset|content)="\/(?!Arq\/)[^"]*"/g)]
        .map((match) => match[0])
        // content="..." matches plain-text meta descriptions only when they
        // start with a slash; none do, but keep the filter honest.
        .filter((attribute) => !attribute.startsWith('content="/Arq'));
      expect(unprefixed, `${page.meta.id}: ${unprefixed.join(', ')}`).toEqual([]);
      expect(html).not.toContain('"/Arq/Arq/');
    }
  });
});

describe('stylesheet base-path safety', () => {
  it('uses only stylesheet-relative url() references, so CSS never needs base rewriting', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'site.css'), 'utf8');
    // A root-absolute url('/...') would 404 under a subpath deployment -
    // exactly the font failure the device sweep caught before launch.
    expect(css).not.toMatch(/url\(\s*['"]?\//);
  });
});

describe('absolutiseOpenGraph', () => {
  it('makes og:image absolute and inserts canonical and og:url', () => {
    const html =
      '<meta property="og:title" content="T" />\n        <meta property="og:image" content="/Arq/assets/og.png" />';
    const out = absolutiseOpenGraph(html, 'https://ruddvz.github.io', '/Arq/product/');
    expect(out).toContain('content="https://ruddvz.github.io/Arq/assets/og.png"');
    expect(out).toContain(
      '<meta property="og:url" content="https://ruddvz.github.io/Arq/product/" />',
    );
    expect(out).toContain('<link rel="canonical" href="https://ruddvz.github.io/Arq/product/" />');
  });
});
