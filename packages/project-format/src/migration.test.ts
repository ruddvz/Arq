import { describe, expect, it } from 'vitest';
import { createMigrationRegistry } from './migration';

describe('createMigrationRegistry', () => {
  it('returns already-current when fromVersion equals toVersion', () => {
    const registry = createMigrationRegistry();
    const result = registry.migrate({ a: 1 }, 2, 2);
    expect(result).toEqual({ status: 'already-current', data: { a: 1 } });
  });

  it('chains multiple registered migrations in order', () => {
    const registry = createMigrationRegistry();
    registry.register({
      sourceVersion: 0,
      targetVersion: 1,
      migrate: (data: { a: number }) => ({ a: data.a, b: 'added-in-v1' }),
    });
    registry.register({
      sourceVersion: 1,
      targetVersion: 2,
      migrate: (data: { a: number; b: string }) => ({ ...data, c: 'added-in-v2' }),
    });
    const result = registry.migrate({ a: 1 }, 0, 2);
    expect(result).toEqual({
      status: 'migrated',
      data: { a: 1, b: 'added-in-v1', c: 'added-in-v2' },
      appliedVersions: [1, 2],
    });
  });

  it('fails when no migration is registered for an intermediate version', () => {
    const registry = createMigrationRegistry();
    registry.register({ sourceVersion: 0, targetVersion: 1, migrate: (data: unknown) => data });
    const result = registry.migrate({}, 0, 5);
    expect(result).toEqual({
      status: 'failed',
      reason: 'no migration registered from version 1',
      failedAtVersion: 1,
    });
  });

  it('fails with a descriptive reason when a migration function throws', () => {
    const registry = createMigrationRegistry();
    registry.register({
      sourceVersion: 0,
      targetVersion: 1,
      migrate: () => {
        throw new Error('corrupt v0 data');
      },
    });
    const result = registry.migrate({}, 0, 1);
    expect(result).toEqual({ status: 'failed', reason: 'corrupt v0 data', failedAtVersion: 0 });
  });

  it('refuses to migrate backwards', () => {
    const registry = createMigrationRegistry();
    const result = registry.migrate({}, 3, 1);
    expect(result.status).toBe('failed');
  });

  it('rejects registering two migrations from the same source version', () => {
    const registry = createMigrationRegistry();
    registry.register({ sourceVersion: 0, targetVersion: 1, migrate: (data: unknown) => data });
    expect(() =>
      registry.register({ sourceVersion: 0, targetVersion: 2, migrate: (data: unknown) => data }),
    ).toThrow(RangeError);
  });
});
