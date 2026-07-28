/*
 * Add this to apps/marketing/src/pages.test.ts after the pages are rendered.
 * The registry remains the semantic source; this test makes rendered public
 * copy bind to it rather than duplicating a second hand-maintained word list.
 */
import claimRegistry from '../../../docs/product/voice/claim-registry.json' with { type: 'json' };
import bindings from '../../../docs/product/voice/claim-binding-registry.json' with { type: 'json' };
import publicCopyInventory from '../../../docs/product/voice/public-copy-inventory.json' with { type: 'json' };
import deployedSiteContract from '../../../docs/product/voice/deployed-site-contract.json' with { type: 'json' };

const PUBLIC_BLOCKED_STATES = new Set(['PROHIBITED', 'CONFLICTED', 'UNKNOWN', 'LIBRARY_ONLY']);

function pageIdForSourcePath(path: string): string | null {
  const match = path.match(/content\/([a-z-]+)\.ts$/);
  if (!match) return null;
  return match[1] ?? null;
}

it('binds public current-state assertions to reviewed claim records', () => {
  const claims = new Map(claimRegistry.claims.map((claim) => [claim.id, claim]));
  for (const binding of bindings.bindings) {
    if (binding.surface !== 'public') continue;
    const claim = claims.get(binding.claimId);
    expect(claim, `${binding.id} references a known claim`).toBeDefined();
    if (binding.assertionMode === 'current') {
      expect(
        PUBLIC_BLOCKED_STATES.has(claim!.state),
        `${binding.id} cannot render ${claim!.state} as current`,
      ).toBe(false);
    }
  }
});

it('lists each public claim binding in the public-copy inventory', () => {
  const listed = new Set(publicCopyInventory.entries.flatMap((entry) => entry.claimBindingIds));
  for (const binding of bindings.bindings) {
    if (binding.surface !== 'public') continue;
    expect(listed.has(binding.id), `${binding.id} is listed in public-copy-inventory.json`).toBe(true);
  }
});

it('maps each rendered public route to exactly one inventory entry', () => {
  const inventory = publicCopyInventory.entries.filter((entry) => entry.route !== '/404');
  const byPageId = new Map(inventory.map((entry) => [entry.pageId, entry]));
  expect(byPageId.size).toBe(inventory.length);
  for (const document of documents) {
    const entry = byPageId.get(document.meta.id);
    expect(entry, `${document.meta.id} must have a public-copy inventory entry`).toBeDefined();
    expect(entry!.route).toBe(document.meta.route);
  }
  expect(deployedSiteContract.repository.routeMapPath).toBe('docs/pages/ROUTE-MAP.csv');
});

it('does not render an em dash in public copy', () => {
  const emDash = String.fromCodePoint(0x2014);
  for (const document of documents) {
    expect(textOf(document.html), `${document.meta.id} must not render U+2014`).not.toContain(emDash);
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
