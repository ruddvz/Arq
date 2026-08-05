import { describe, expect, it } from 'vitest';
import type { ExtensionManifest } from './extension-manifest';
import {
  BROKER_DENIAL_CODES,
  decideExtensionRequest,
  permittedRequestKinds,
  requestIsSerialisable,
  type ExtensionRequest,
} from './extension-host-boundary';

function manifest(overrides: Partial<ExtensionManifest> = {}): ExtensionManifest {
  return {
    id: 'com.example.wall-namer',
    name: 'Wall Namer',
    version: '1.0.0',
    publisher: 'Example Ltd',
    capabilities: ['model.read', 'model.propose'],
    canonicalDataEffects: [
      { categories: ['Wall'], access: 'read', reason: 'to find unnamed walls' },
      { categories: ['Wall'], access: 'propose', reason: 'to suggest names' },
    ],
    ...overrides,
  };
}

const EVERY_REQUEST: readonly ExtensionRequest[] = [
  { kind: 'model.read', category: 'Wall', elementIds: ['wall-1'] },
  { kind: 'model.propose', category: 'Wall', operations: [{ type: 'update-property' }] },
  { kind: 'selection.read' },
  { kind: 'selection.request', elementIds: ['wall-1'] },
  { kind: 'ui.contribute', surface: 'inspector', title: 'Names' },
  { kind: 'storage.own.get', key: 'settings' },
  { kind: 'storage.own.set', key: 'settings', value: '{}' },
  { kind: 'network.fetch', url: 'https://api.example.com/names' },
];

describe('decideExtensionRequest', () => {
  it('allows a declared request within a declared category', () => {
    const decision = decideExtensionRequest(manifest(), {
      kind: 'model.read',
      category: 'Wall',
      elementIds: ['wall-1'],
    });

    expect(decision).toEqual({ allowed: true, capability: 'model.read' });
  });

  it('denies a capability the manifest never declared', () => {
    const decision = decideExtensionRequest(manifest(), { kind: 'selection.read' });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.code).toBe(BROKER_DENIAL_CODES.capabilityNotDeclared);
  });

  it('denies a category the manifest never covered, even with the capability', () => {
    const decision = decideExtensionRequest(manifest(), {
      kind: 'model.read',
      category: 'Room',
      elementIds: [],
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.code).toBe(BROKER_DENIAL_CODES.categoryNotDeclared);
  });

  it('reports an undeclared capability as undeclared, not as out of scope', () => {
    // The two call for different fixes from the publisher.
    const decision = decideExtensionRequest(manifest({ capabilities: [] }), {
      kind: 'model.read',
      category: 'Room',
      elementIds: [],
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.code).toBe(BROKER_DENIAL_CODES.capabilityNotDeclared);
  });

  it('does not let a propose request through a read-only manifest', () => {
    const readOnly = manifest({
      capabilities: ['model.read'],
      canonicalDataEffects: [{ categories: ['Wall'], access: 'read', reason: 'x' }],
    });

    const decision = decideExtensionRequest(readOnly, {
      kind: 'model.propose',
      category: 'Wall',
      operations: [],
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.code).toBe(BROKER_DENIAL_CODES.capabilityNotDeclared);
  });

  describe('network', () => {
    const networked = manifest({
      capabilities: ['model.read', 'network.declared-origins'],
      networkOrigins: ['https://api.example.com'],
    });

    it('allows a declared origin', () => {
      expect(
        decideExtensionRequest(networked, {
          kind: 'network.fetch',
          url: 'https://api.example.com/names',
        }).allowed,
      ).toBe(true);
    });

    it('denies an undeclared origin', () => {
      const decision = decideExtensionRequest(networked, {
        kind: 'network.fetch',
        url: 'https://collector.example.net/upload',
      });

      expect(decision.allowed).toBe(false);
      if (decision.allowed) return;
      expect(decision.code).toBe(BROKER_DENIAL_CODES.originNotDeclared);
    });

    it('compares origins rather than string prefixes', () => {
      // "https://api.example.com.evil.test" starts with a declared origin and
      // is an entirely different host.
      const decision = decideExtensionRequest(networked, {
        kind: 'network.fetch',
        url: 'https://api.example.com.evil.test/upload',
      });

      expect(decision.allowed).toBe(false);
      if (decision.allowed) return;
      expect(decision.code).toBe(BROKER_DENIAL_CODES.originNotDeclared);
    });

    it('denies a subdomain of a declared origin', () => {
      expect(
        decideExtensionRequest(networked, {
          kind: 'network.fetch',
          url: 'https://internal.api.example.com/x',
        }).allowed,
      ).toBe(false);
    });

    it('denies a malformed url distinctly from an undeclared one', () => {
      const decision = decideExtensionRequest(networked, {
        kind: 'network.fetch',
        url: 'not a url',
      });

      expect(decision.allowed).toBe(false);
      if (decision.allowed) return;
      expect(decision.code).toBe(BROKER_DENIAL_CODES.malformedUrl);
    });
  });
});

describe('the request boundary is a data boundary', () => {
  it('carries only plain data, in every variant', () => {
    // AC3-100 is lost the moment a handle, a port or a closure can cross. A
    // message that survives a JSON round trip unchanged cannot be carrying one.
    expect(EVERY_REQUEST.every(requestIsSerialisable)).toBe(true);
  });

  it('rejects a request smuggling a function', () => {
    const smuggled = {
      kind: 'model.read',
      category: 'Wall',
      elementIds: [],
      getHandle: () => null,
    } as unknown as ExtensionRequest;

    expect(requestIsSerialisable(smuggled)).toBe(false);
  });

  it('rejects a request smuggling a class instance', () => {
    class FakePort {
      readonly name = 'canonical-worker';
    }
    const smuggled = {
      kind: 'model.read',
      category: 'Wall',
      elementIds: [],
      port: new FakePort(),
    } as unknown as ExtensionRequest;

    expect(requestIsSerialisable(smuggled)).toBe(false);
  });

  it('rejects a request smuggling a bigint or symbol', () => {
    const withBigint = {
      kind: 'storage.own.set',
      key: 'k',
      value: '',
      handle: 1n,
    } as unknown as ExtensionRequest;

    expect(requestIsSerialisable(withBigint)).toBe(false);
  });

  it('has no request naming raw storage, a database or the worker', () => {
    const forbidden = ['sqlite', 'opfs', 'worker', 'filesystem', 'eval'];
    const kinds = EVERY_REQUEST.map((request) => request.kind.toLowerCase());

    expect(kinds.filter((kind) => forbidden.some((word) => kind.includes(word)))).toEqual([]);
  });
});

describe('permittedRequestKinds', () => {
  it('derives the boundary from the manifest, so it cannot drift from enforcement', () => {
    expect(permittedRequestKinds(manifest())).toEqual(['model.read', 'model.propose']);
  });

  it('is empty for a manifest that declared nothing', () => {
    expect(permittedRequestKinds(manifest({ capabilities: [] }))).toEqual([]);
  });

  it('includes both storage kinds under the one capability', () => {
    const stored = manifest({ capabilities: ['storage.own'] });

    expect(permittedRequestKinds(stored)).toEqual(['storage.own.get', 'storage.own.set']);
  });
});
