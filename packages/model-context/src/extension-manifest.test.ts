import { describe, expect, it } from 'vitest';
import {
  EXTENSION_CAPABILITIES,
  MANIFEST_REJECTION_CODES,
  describeCanonicalEffects,
  isKnownCapability,
  manifestPermits,
  validateExtensionManifest,
  type ExtensionManifest,
} from './extension-manifest';

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

describe('validateExtensionManifest', () => {
  it('accepts a manifest whose effects are each backed by a capability', () => {
    expect(validateExtensionManifest(manifest()).status).toBe('valid');
  });

  it('refuses a capability the host does not grant', () => {
    // A closed set is what makes "not declared" mean "not available" rather
    // than "not thought about".
    const result = validateExtensionManifest(
      manifest({ capabilities: ['filesystem.raw' as never] }),
    );

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.code).toBe(MANIFEST_REJECTION_CODES.unknownCapability);
  });

  it('refuses a data effect with no capability behind it', () => {
    const result = validateExtensionManifest(
      manifest({
        capabilities: ['model.read'],
        canonicalDataEffects: [{ categories: ['Wall'], access: 'propose', reason: 'because' }],
      }),
    );

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.code).toBe(MANIFEST_REJECTION_CODES.effectWithoutCapability);
  });

  it('allows a wildcard effect only with a reason a reviewer can weigh', () => {
    const unjustified = validateExtensionManifest(
      manifest({
        canonicalDataEffects: [{ categories: ['*'], access: 'read', reason: '  ' }],
      }),
    );
    const justified = validateExtensionManifest(
      manifest({
        capabilities: ['model.read'],
        canonicalDataEffects: [
          { categories: ['*'], access: 'read', reason: 'measures total floor area' },
        ],
      }),
    );

    expect(unjustified.status).toBe('rejected');
    if (unjustified.status === 'rejected') {
      expect(unjustified.code).toBe(MANIFEST_REJECTION_CODES.unjustifiedWildcard);
    }
    expect(justified.status).toBe('valid');
  });

  it('refuses the network capability with no origins to reach', () => {
    const result = validateExtensionManifest(
      manifest({ capabilities: ['model.read', 'model.propose', 'network.declared-origins'] }),
    );

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.code).toBe(MANIFEST_REJECTION_CODES.undeclaredNetwork);
  });

  it('refuses origins declared without the capability that reaches them', () => {
    const result = validateExtensionManifest(
      manifest({ networkOrigins: ['https://api.example.com'] }),
    );

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.code).toBe(MANIFEST_REJECTION_CODES.networkWithoutCapability);
  });

  it('refuses a plaintext origin, since project content would travel over it', () => {
    const result = validateExtensionManifest(
      manifest({
        capabilities: ['model.read', 'model.propose', 'network.declared-origins'],
        networkOrigins: ['http://api.example.com'],
      }),
    );

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.code).toBe(MANIFEST_REJECTION_CODES.insecureOrigin);
  });

  it('requires a publisher, so an install decision has someone to be about', () => {
    const result = validateExtensionManifest(manifest({ publisher: '  ' }));

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.code).toBe(MANIFEST_REJECTION_CODES.malformed);
  });
});

describe('manifestPermits', () => {
  it('grants only the declared category', () => {
    expect(manifestPermits(manifest(), 'read', 'Wall')).toBe(true);
    expect(manifestPermits(manifest(), 'read', 'Room')).toBe(false);
  });

  it('does not let propose imply read, or read imply propose', () => {
    // A naming tool that reads every room while proposing changes only to walls
    // is a real shape, and collapsing the two would over-grant it.
    const readOnly = manifest({
      capabilities: ['model.read'],
      canonicalDataEffects: [{ categories: ['Room'], access: 'read', reason: 'lists rooms' }],
    });

    expect(manifestPermits(readOnly, 'read', 'Room')).toBe(true);
    expect(manifestPermits(readOnly, 'propose', 'Room')).toBe(false);
  });

  it('honours a wildcard effect', () => {
    const wide = manifest({
      capabilities: ['model.read'],
      canonicalDataEffects: [{ categories: ['*'], access: 'read', reason: 'measures areas' }],
    });

    expect(manifestPermits(wide, 'read', 'Stair')).toBe(true);
  });

  it('grants nothing when the capability is missing, whatever the effects say', () => {
    const noCapability = manifest({
      capabilities: [],
      canonicalDataEffects: [{ categories: ['Wall'], access: 'read', reason: 'x' }],
    });

    expect(manifestPermits(noCapability, 'read', 'Wall')).toBe(false);
  });
});

describe('describeCanonicalEffects', () => {
  it('derives the install text from what will be enforced', () => {
    // A publisher-authored description can say anything.
    expect(describeCanonicalEffects(manifest())).toEqual([
      'Reads Wall. to find unnamed walls',
      'Proposes changes to Wall. to suggest names',
    ]);
  });

  it('spells a wildcard out rather than printing an asterisk', () => {
    const wide = manifest({
      capabilities: ['model.read'],
      canonicalDataEffects: [{ categories: ['*'], access: 'read', reason: 'measures areas' }],
    });

    expect(describeCanonicalEffects(wide)[0]).toContain('every element');
  });
});

describe('EXTENSION_CAPABILITIES', () => {
  it('grants no raw storage, database or worker capability', () => {
    // AC3-100's failure is arbitrary SQLite or OPFS access. There is no
    // capability that could name it.
    const forbidden = ['sqlite', 'opfs', 'worker', 'filesystem', 'eval', 'process'];
    const offenders = EXTENSION_CAPABILITIES.filter((capability) =>
      forbidden.some((word) => capability.toLowerCase().includes(word)),
    );

    expect(offenders).toEqual([]);
  });

  it('recognises exactly its own members', () => {
    expect(EXTENSION_CAPABILITIES.every(isKnownCapability)).toBe(true);
    expect(isKnownCapability('storage.raw')).toBe(false);
  });
});
