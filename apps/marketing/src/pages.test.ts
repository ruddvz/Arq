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
        expect(document.html).toMatch(/<main\s+id="content"(?:\s+class="family-\w+")?\s*>/);
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

  /**
   * DRIFT-NATIVE-OPEN-MARKETING, the mirror of the 3D case above. That conflict
   * began as copy promising an open the product could not do, and ended as copy
   * denying an open it had shipped, so both directions are pinned here: the
   * pages must state the open, and they must not state a save.
   *
   * The no-save assertion is the load-bearing one. "It opens" is the sentence a
   * reader remembers, and a reader who remembers only that will assume their
   * work is going back into the file they picked. It is not, and every page
   * that says the first thing has to say the second.
   */
  describe('native .arq open', () => {
    const OPEN_STATED = ['PUB-001', 'PUB-002', 'PUB-003'];

    it('records the open conflict as resolved and the claim as current', () => {
      const activeStatuses = new Set(conflictRegistry.activeStatuses);
      const drift = conflictRegistry.conflicts.find(
        (conflict) => conflict.id === 'DRIFT-NATIVE-OPEN-MARKETING',
      );
      expect(drift?.status).toBe('resolved');
      expect(activeStatuses.has(drift?.status ?? '')).toBe(false);
      const claim = claimRegistry.claims.find((entry) => entry.id === 'native-arq-open');
      expect(claim?.state).toBe('CURRENT');
    });

    it('keeps writing back to the chosen file a blocked claim', () => {
      // The open is current; publication is not, and nothing about promoting
      // the first may quietly promote the second.
      const claim = claimRegistry.claims.find((entry) => entry.id === 'portable-arq-publication');
      expect(claim?.state).toBe('LIBRARY_ONLY');
    });

    it('no longer denies that a project opens', () => {
      for (const document of documents) {
        const text = textOf(document.html);
        expect(text, `${document.meta.id} must not deny the shipped open`).not.toMatch(
          /\b(open|opening|reading)\b[^.]{0,90}\bnot wired\b/,
        );
        expect(text, `${document.meta.id} must not deny the shipped open`).not.toMatch(
          /neither the browser build nor a native build opens/,
        );
      }
    });

    it('states the open on the pages bound to the claim', () => {
      for (const id of OPEN_STATED) {
        const document = documents.find((entry) => entry.meta.id === id);
        expect(document, `${id} is rendered`).toBeDefined();
        const text = textOf(document?.html ?? '');
        // The window has to admit full stops: the token being matched is
        // ".arq", so a class excluding "." can never reach it.
        expect(text, `${id} states that an .arq project opens`).toMatch(
          /\.arq\b.{0,160}?\bopens?\b|\bopens?\b.{0,160}?\.arq\b/,
        );
      }
    });

    it('carries the no-save limit wherever it states the open', () => {
      for (const id of OPEN_STATED) {
        const document = documents.find((entry) => entry.meta.id === id);
        const text = textOf(document?.html ?? '');
        expect(text, `${id} says the chosen file is not written to`).toMatch(
          /\bnot (?:be )?written (?:back )?to\b|\bdoes not (?:yet )?save\b|\bcannot yet be written back\b|\bnothing is written back\b/,
        );
      }
    });

    it('never claims work is saved into the chosen .arq file', () => {
      for (const document of documents) {
        const text = textOf(document.html);
        expect(text, `${document.meta.id} must not claim a portable save`).not.toMatch(
          /\bsaved? (?:your work )?(?:back )?(?:in)?to (?:your |the |a )?(?:portable )?\.arq\b/,
        );
        expect(text, `${document.meta.id} must not claim a portable save`).not.toMatch(
          /\bportable \.arq file (?:is )?updated\b/,
        );
      }
    });
  });
});
