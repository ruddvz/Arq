import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderDocument } from './layout.js';
import { allPages } from './routes.js';
import { findRepoRoot, type Sbom } from './open-source-data.js';
import { PRIMARY_NAV } from './site.js';
import claimRegistry from '../../../docs/product/voice/claim-registry.json' with { type: 'json' };
import bindings from '../../../docs/product/voice/claim-binding-registry.json' with { type: 'json' };
import conflictRegistry from '../../../docs/product/voice/conflict-registry.json' with { type: 'json' };
import publicCopyInventory from '../../../docs/product/voice/public-copy-inventory.json' with { type: 'json' };
import deployedSiteContract from '../../../docs/product/voice/deployed-site-contract.json' with { type: 'json' };

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

      it('keeps only the not-found page out of search indexes', () => {
        if (document.meta.route === '/404') {
          expect(document.html).toContain('name="robots" content="noindex, nofollow"');
        } else {
          expect(document.html).not.toContain('name="robots" content="noindex');
        }
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

describe('pre-release status', () => {
  it('every sheet carries the pre-release status in its title block', () => {
    for (const document of documents) {
      expect(document.html).toContain('Pre-release, in development');
    }
  });
});

/**
 * ARQ Language System 4.1. The registries under docs/product/voice/ are the
 * semantic source; these tests bind the rendered public copy to them instead of
 * duplicating a second hand-maintained word list. Adapted from
 * docs/product/voice/marketing-claim-test.fragment.ts.
 */
describe('language system 4.1 claim gates', () => {
  const PUBLIC_BLOCKED_STATES = new Set(['PROHIBITED', 'CONFLICTED', 'UNKNOWN', 'LIBRARY_ONLY']);

  it('binds public current-state assertions to reviewed claim records', () => {
    const claims = new Map(claimRegistry.claims.map((claim) => [claim.id, claim]));
    for (const binding of bindings.bindings) {
      if (binding.surface !== 'public') continue;
      const claim = claims.get(binding.claimId);
      expect(claim, `${binding.id} references a known claim`).toBeDefined();
      if (binding.assertionMode === 'current') {
        expect(
          PUBLIC_BLOCKED_STATES.has(claim?.state ?? ''),
          `${binding.id} cannot render ${claim?.state} as current`,
        ).toBe(false);
      }
    }
  });

  it('lists each public claim binding in the public-copy inventory', () => {
    const listed = new Set(
      publicCopyInventory.entries.flatMap((entry) => entry.claimBindingIds as readonly string[]),
    );
    for (const binding of bindings.bindings) {
      if (binding.surface !== 'public') continue;
      expect(listed.has(binding.id), `${binding.id} is listed in public-copy-inventory`).toBe(true);
    }
  });

  it('maps each rendered public route to exactly one inventory entry', () => {
    const inventory = publicCopyInventory.entries.filter((entry) => entry.route !== '/404');
    const byPageId = new Map(inventory.map((entry) => [entry.pageId, entry]));
    expect(byPageId.size).toBe(inventory.length);
    for (const document of documents) {
      if (document.meta.route === '/404') continue;
      const entry = byPageId.get(document.meta.id);
      expect(entry, `${document.meta.id} must have a public-copy inventory entry`).toBeDefined();
      expect(entry?.route).toBe(document.meta.route);
    }
    expect(deployedSiteContract.repository.routeMapPath).toBe('docs/pages/ROUTE-MAP.csv');
  });

  it('does not render an em dash in public copy', () => {
    const emDash = String.fromCodePoint(0x2014);
    for (const document of documents) {
      expect(document.html, `${document.meta.id} must not render U+2014`).not.toContain(emDash);
    }
  });

  it('labels release-scope text as scope rather than current availability', () => {
    for (const document of documents) {
      const text = textOf(document.html);
      if (/release [1-4]/.test(text)) {
        expect(
          /release scope|planned|pre-release|in development/.test(text),
          `${document.meta.id} must label release ladder statements as non-current scope`,
        ).toBe(true);
      }
    }
  });

  it('does not use compatibility as proof that a project is open', () => {
    for (const document of documents) {
      const text = textOf(document.html);
      expect(text).not.toMatch(/compatible arq project[^.]{0,80}\b(opened|ready)\b/);
    }
  });

  it('keeps an active conflict out of the public copy as a settled fact', () => {
    const activeStatuses = new Set(conflictRegistry.activeStatuses);
    const active = conflictRegistry.conflicts.filter((conflict) =>
      activeStatuses.has(conflict.status),
    );
    // CONFLICT-3D-CURRENT-STATUS was resolved by the run-model-canvas
    // capability check (3D tab reachable, WebGL2 render, plan-shared
    // selection), so it must no longer be counted as active; a regression to
    // an active status would silently re-block the verified copy below.
    const threeD = conflictRegistry.conflicts.find(
      (conflict) => conflict.id === 'CONFLICT-3D-CURRENT-STATUS',
    );
    expect(threeD?.status).toBe('resolved');
    expect(active.some((conflict) => conflict.id === 'CONFLICT-3D-CURRENT-STATUS')).toBe(false);
    for (const document of documents) {
      const text = textOf(document.html);
      // The resolved truth is a viewing surface. Public copy still must not
      // overstate it as a 3D modelling workspace, and must never claim the
      // surface is absent - that side of the old dispute stays false.
      expect(text).not.toMatch(
        /\b3d (modelling|modeling|authoring)\b[^.]{0,60}\b(is available|works today|is current)\b/,
      );
      expect(text).not.toMatch(/\bno 3d (view|tab|surface)\b[^.]{0,40}\bexists\b/);
    }
  });
});
