import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { openArqfs } from './arqfs-open';
import {
  declareFeatureFlag,
  readFeatureFlags,
  unsupportedRequiredFeatures,
} from './arqfs-feature-flags';
import type { ArqfsDriver } from './arqfs-driver';

describe('arqfs-feature-flags', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    return driver;
  }

  it('a file with no declared feature flags opens with full capabilities, as before this feature existed', () => {
    const d = freshDriver();
    const result = openArqfs(d);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.capabilities.canRead).toBe(true);
      expect(result.capabilities.unsupportedRequiredFeatures).toEqual([]);
    }
  });

  it('a required feature this reader knows about does not block opening', () => {
    const d = freshDriver();
    declareFeatureFlag(d, { name: 'content-addressed-chunks-v1', required: true });

    const result = openArqfs(d);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.capabilities.canRead).toBe(true);
      expect(result.capabilities.canWrite).toBe(true);
      expect(result.capabilities.unsupportedRequiredFeatures).toEqual([]);
    }
  });

  it('an unrecognised required feature refuses to open at all, listed by name', () => {
    const d = freshDriver();
    declareFeatureFlag(d, { name: 'some-future-feature-v7', required: true });

    const result = openArqfs(d);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.capabilities.canRead).toBe(false);
      expect(result.capabilities.canWrite).toBe(false);
      expect(result.capabilities.safeModeRequired).toBe(true);
      expect(result.capabilities.unsupportedRequiredFeatures).toEqual(['some-future-feature-v7']);
    }
  });

  it('an unrecognised OPTIONAL feature does not block opening, matching "unknown optional sections ignored safely"', () => {
    const d = freshDriver();
    declareFeatureFlag(d, { name: 'some-future-feature-v7', required: false });

    const result = openArqfs(d);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.capabilities.canRead).toBe(true);
      expect(result.capabilities.unsupportedRequiredFeatures).toEqual([]);
    }
  });

  it('declaring the same flag name again updates required rather than duplicating rows', () => {
    const d = freshDriver();
    declareFeatureFlag(d, { name: 'flag-a', required: false });
    declareFeatureFlag(d, { name: 'flag-a', required: true });

    expect(readFeatureFlags(d)).toEqual([{ name: 'flag-a', required: true }]);
  });

  it('unsupportedRequiredFeatures only reports required flags the given known-set does not contain', () => {
    const flags = [
      { name: 'known-1', required: true },
      { name: 'unknown-1', required: true },
      { name: 'unknown-optional', required: false },
    ];
    expect(unsupportedRequiredFeatures(flags, new Set(['known-1']))).toEqual(['unknown-1']);
  });
});
