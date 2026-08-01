import { describe, expect, it } from 'vitest';
import {
  contentHash,
  fieldName,
  opaqueId,
  operationTypeName,
  resultCode,
  semanticVersion,
} from './identifiers';

describe('identifier grammars are separate on purpose', () => {
  it('accepts the camelCase property names the Arq model actually uses', () => {
    // The reviewed 2.0 package validated projected field names with its
    // operation-type pattern, so this exact projection was impossible.
    for (const name of ['hostWallId', 'heightOverride', 'calculatedArea', 'levelId', '_debug']) {
      expect(fieldName().validate(name).ok).toBe(true);
    }
  });

  it('does not accept a property name as an operation type', () => {
    expect(operationTypeName().validate('hostWallId').ok).toBe(false);
  });

  it('rejects punctuation soup that the 2.0 operation pattern accepted', () => {
    for (const name of ['a:::b', 'a..b', '.a', 'a.', 'a--b.c', 'A.b']) {
      expect(operationTypeName().validate(name).ok).toBe(false);
    }
  });

  it('accepts real dotted operation names', () => {
    for (const name of [
      'architecture.wall.create',
      'plan_render_cache',
      'vehicle.fuselage.create',
    ]) {
      expect(operationTypeName().validate(name).ok).toBe(true);
    }
  });
});

describe('opaque identifiers', () => {
  it('accepts Arq handles and rejects paths', () => {
    expect(opaqueId().validate('project-4f2a').ok).toBe(true);
    expect(opaqueId().validate('rev:000012').ok).toBe(true);
    expect(opaqueId().validate('/Users/a/house.arq').ok).toBe(false);
    expect(opaqueId().validate('C:\\house.arq').ok).toBe(false);
    expect(opaqueId().validate('../../etc/passwd').ok).toBe(false);
    expect(opaqueId().validate('').ok).toBe(false);
    expect(opaqueId().validate('a'.repeat(129)).ok).toBe(false);
  });
});

describe('semantic versions', () => {
  it('rejects leading zeros, which compare unequal to their canonical form', () => {
    expect(semanticVersion().validate('1.0.0').ok).toBe(true);
    expect(semanticVersion().validate('0.1.0').ok).toBe(true);
    expect(semanticVersion().validate('01.0.0').ok).toBe(false);
    expect(semanticVersion().validate('1.00.0').ok).toBe(false);
    expect(semanticVersion().validate('1.0').ok).toBe(false);
  });
});

describe('content hashes and result codes', () => {
  it('requires a lower-case sha256 digest with its algorithm named', () => {
    const digest = `sha256:${'a'.repeat(64)}`;
    expect(contentHash().validate(digest).ok).toBe(true);
    expect(contentHash().validate(`sha256:${'A'.repeat(64)}`).ok).toBe(false);
    expect(contentHash().validate('a'.repeat(64)).ok).toBe(false);
  });

  it('requires result codes to be namespaced', () => {
    expect(resultCode().validate('ARQ_PROJECT_NOT_FOUND').ok).toBe(true);
    expect(resultCode().validate('PROJECT_NOT_FOUND').ok).toBe(false);
    expect(resultCode().validate('arq_project_not_found').ok).toBe(false);
  });
});
