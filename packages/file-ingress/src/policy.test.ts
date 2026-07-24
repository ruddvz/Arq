import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_POLICY, deserialiseImportPolicy, serialiseImportPolicy } from './policy';

describe('serialiseImportPolicy / deserialiseImportPolicy', () => {
  it('round-trips the default policy unchanged', () => {
    const serialised = serialiseImportPolicy(DEFAULT_IMPORT_POLICY);
    expect(deserialiseImportPolicy(serialised)).toEqual(DEFAULT_IMPORT_POLICY);
  });

  it('rejects a non-positive maxSourceBytes', () => {
    expect(() => deserialiseImportPolicy({ ...DEFAULT_IMPORT_POLICY, maxSourceBytes: 0 })).toThrow(
      /maxSourceBytes/,
    );
    expect(() => deserialiseImportPolicy({ ...DEFAULT_IMPORT_POLICY, maxSourceBytes: -1 })).toThrow(
      /maxSourceBytes/,
    );
  });

  it('rejects a non-positive maxStagedElements', () => {
    expect(() =>
      deserialiseImportPolicy({ ...DEFAULT_IMPORT_POLICY, maxStagedElements: 0 }),
    ).toThrow(/maxStagedElements/);
  });

  it('rejects a non-positive maxTextCodePoints', () => {
    expect(() =>
      deserialiseImportPolicy({ ...DEFAULT_IMPORT_POLICY, maxTextCodePoints: 0 }),
    ).toThrow(/maxTextCodePoints/);
  });

  it('defaults to disallowing a network bridge and allowing attachment fallback', () => {
    expect(DEFAULT_IMPORT_POLICY.allowNetworkBridge).toBe(false);
    expect(DEFAULT_IMPORT_POLICY.allowAttachmentFallback).toBe(true);
  });
});
