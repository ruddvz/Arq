import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderDocument } from './layout.js';
import { allPages } from './routes.js';
import { findRepoRoot, type Sbom } from './open-source-data.js';
import { PRIMARY_NAV } from './site.js';

/**
 * Site-wide invariants, enforced - the PUB page specs' shared acceptance
 * criteria (docs/pages/PUB-*.md) and the launch-claims checklist
 * (business/LAUNCH-CLAIMS-CHECKLIST.md) as tests rather than intentions.
 */

const FIXTURE_SBOM: Sbom = {
  generatedAt: '2026-07-27T00:00:00.000Z',
  packageCount: 2,
  packages: [
    { name: 'example-a', version: '1.0.0', licence: 'MIT' },
    { name: 'example-b', version: '2.0.0', licence: 'ISC' },
  ],
};

const pages = allPages(FIXTURE_SBOM);
const documents = pages.map((page) => ({
  meta: page.meta,
  html: renderDocument(page.meta, page.render()),
}));

function textOf(document: string): string {
  return document
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

describe('route coverage', () => {
  it('implements every public route in docs/pages/ROUTE-MAP.csv exactly', () => {
    const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
    const routeMap = readFileSync(join(repoRoot, 'docs', 'pages', 'ROUTE-MAP.csv'), 'utf8');
    const specced = routeMap
      .split('\n')
      .filter((line) => line.startsWith('PUB-'))
      .map((line) => {
        const [id, , route] = line.split(',');
        return { id: id ?? '', route: route ?? '' };
      });
    expect(specced).toHaveLength(17);
    for (const spec of specced) {
      const page = pages.find((candidate) => candidate.meta.id === spec.id);
      expect(page, `${spec.id} has no implementation`).toBeDefined();
      expect(page?.meta.route, `${spec.id} route drifted from ROUTE-MAP.csv`).toBe(spec.route);
    }
  });

  it('has unique routes and ids', () => {
    const routes = pages.map((page) => page.meta.route);
    const ids = pages.map((page) => page.meta.id);
    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes a not-found sheet', () => {
    expect(pages.some((page) => page.meta.route === '/404')).toBe(true);
  });
});

describe('per-page acceptance criteria', () => {
  for (const document of documents) {
    describe(`${document.meta.id} ${document.meta.route}`, () => {
      it('has exactly one h1', () => {
        expect(document.html.match(/<h1[\s>]/g)).toHaveLength(1);
      });

      it('has the skip link first and a main landmark it targets', () => {
        expect(document.html).toContain('class="skip-link" href="#content"');
        expect(document.html).toContain('<main id="content">');
      });

      it('has header, nav and footer landmarks', () => {
        for (const tag of ['<header', '<nav', '<footer']) {
          expect(document.html).toContain(tag);
        }
      });

      it('has a non-empty meta description of honest length', () => {
        const match = document.html.match(/<meta name="description" content="([^"]*)"/);
        expect(match?.[1]?.length ?? 0).toBeGreaterThan(50);
        expect(match?.[1]?.length ?? 0).toBeLessThan(320);
      });

      it('declares language, viewport, favicon, manifest and Open Graph tags', () => {
        expect(document.html).toContain('<html lang="en">');
        expect(document.html).toContain('name="viewport"');
        expect(document.html).toContain('rel="icon" href="/favicon.svg"');
        expect(document.html).toContain('rel="manifest"');
        expect(document.html).toContain('property="og:title"');
        expect(document.html).toContain('property="og:image"');
      });

      it('loads no third-party resource and links nowhere external', () => {
        expect(document.html).not.toContain('https://');
        expect(document.html).not.toContain('http://');
      });

      it('marks the active primary-nav item with aria-current', () => {
        const inPrimaryNav = PRIMARY_NAV.some((item) => item.route === document.meta.route);
        if (inPrimaryNav) {
          expect(document.html).toContain(`href="${document.meta.route}" aria-current="page"`);
        }
      });
    });
  }
});

describe('internal links resolve', () => {
  const knownRoutes = new Set(pages.map((page) => page.meta.route));
  knownRoutes.add('/'); // home route renders as "/" already, kept explicit

  it('every route-shaped href on every page points at a real sheet', () => {
    for (const document of documents) {
      const hrefs = [...document.html.matchAll(/href="(\/[^"]*)"/g)]
        .map((match) => match[1] ?? '')
        .filter((href) => !href.startsWith('/assets/'))
        .filter((href) => !/\.\w+$/.test(href)) // files like /favicon.svg
        .map((href) => href.split('#')[0] ?? '');
      for (const href of hrefs) {
        expect(knownRoutes.has(href), `${document.meta.id} links to unknown route ${href}`).toBe(
          true,
        );
      }
    }
  });
});

describe('launch-claims checklist (business/LAUNCH-CLAIMS-CHECKLIST.md)', () => {
  /**
   * Sensitive claim phrases may appear only inside a sentence that negates or
   * disclaims them ("does not", "never", "without evidence", ...). An
   * affirmative use anywhere on the public site fails the build.
   */
  const SENSITIVE = [
    'full cad',
    'full bim',
    'full ifc',
    'revit replacement',
    'replaces revit',
    'survey-grade',
    'survey grade',
    'code compliance',
    'structural safety',
    'zero data loss',
    'lossless',
    'certified',
    'guaranteed',
  ];
  const NEGATORS =
    /(not|never|no |none|without|cannot|will not|prohibit|forbid|rather than|instead of|deferred)/;

  it('uses sensitive phrases only in negated or disclaiming sentences', () => {
    for (const document of documents) {
      const text = textOf(document.html);
      const sentences = text.split(/[.!?]/);
      for (const phrase of SENSITIVE) {
        for (const sentence of sentences) {
          if (sentence.includes(phrase)) {
            expect(
              NEGATORS.test(sentence),
              `${document.meta.id}: affirmative use of "${phrase}" in: "${sentence.trim()}"`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('never claims DWG or RVT support as committed', () => {
    for (const document of documents) {
      const text = textOf(document.html);
      for (const phrase of ['dwg support', 'rvt support', 'opens dwg', 'opens rvt']) {
        expect(text.includes(phrase), `${document.meta.id} claims "${phrase}"`).toBe(false);
      }
    }
  });
});

describe('pre-release honesty', () => {
  it('every sheet carries the pre-release status in its title block', () => {
    for (const document of documents) {
      expect(document.html).toContain('Pre-release — in development');
    }
  });
});
