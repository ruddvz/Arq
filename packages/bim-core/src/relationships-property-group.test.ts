import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildRelationshipsPropertyGroup,
  findRelationshipEntry,
  missingRelationshipEntry,
  relationshipEntry,
  type RelationshipEntry,
} from './relationships-property-group';

describe('relationshipEntry', () => {
  it('wraps the related ids as a calculated state and copies the array', () => {
    const ids = ['opening-1', 'opening-2'];
    const entry = relationshipEntry('hostedOpenings', 'hosts', ids);
    expect(entry).toEqual({
      key: 'hostedOpenings',
      kind: 'hosts',
      relatedIds: { kind: 'calculated', value: ['opening-1', 'opening-2'] },
    });
    expect(entry.relatedIds.kind === 'calculated' && entry.relatedIds.value).not.toBe(ids);
  });

  it('represents a calculated-but-empty relationship distinctly from missing', () => {
    const entry = relationshipEntry('hostedOpenings', 'hosts', []);
    expect(entry.relatedIds).toEqual({ kind: 'calculated', value: [] });
  });
});

describe('missingRelationshipEntry', () => {
  it('represents a relationship kind that does not apply to this element', () => {
    const entry = missingRelationshipEntry('hostWall', 'hostedBy');
    expect(entry).toEqual({ key: 'hostWall', kind: 'hostedBy', relatedIds: { kind: 'missing' } });
  });
});

describe('buildRelationshipsPropertyGroup', () => {
  it('copies the given entries in order', () => {
    const entries: readonly RelationshipEntry[] = [
      relationshipEntry('hostedOpenings', 'hosts', ['opening-1']),
      missingRelationshipEntry('hostWall', 'hostedBy'),
    ];
    const group = buildRelationshipsPropertyGroup(entries);
    expect(group.relationships).toEqual(entries);
    expect(group.relationships).not.toBe(entries);
  });

  it('accepts an empty entry list', () => {
    expect(buildRelationshipsPropertyGroup([]).relationships).toEqual([]);
  });

  it('rejects duplicate keys', () => {
    const entries: readonly RelationshipEntry[] = [
      relationshipEntry('hostedOpenings', 'hosts', []),
      missingRelationshipEntry('hostedOpenings', 'hosts'),
    ];
    expect(() => buildRelationshipsPropertyGroup(entries)).toThrow(/duplicate relationship key/);
  });

  it('property: any list of entries with distinct keys never throws', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 20 }), (keys) => {
        const entries = keys.map((key) => relationshipEntry(key, 'references', []));
        expect(() => buildRelationshipsPropertyGroup(entries)).not.toThrow();
      }),
    );
  });
});

describe('findRelationshipEntry', () => {
  it('finds an entry by key', () => {
    const group = buildRelationshipsPropertyGroup([
      relationshipEntry('hostedOpenings', 'hosts', ['opening-1']),
    ]);
    expect(findRelationshipEntry(group, 'hostedOpenings')).toEqual({
      key: 'hostedOpenings',
      kind: 'hosts',
      relatedIds: { kind: 'calculated', value: ['opening-1'] },
    });
  });

  it('returns undefined when the key is absent', () => {
    expect(findRelationshipEntry(buildRelationshipsPropertyGroup([]), 'hostedOpenings')).toBeUndefined();
  });
});
