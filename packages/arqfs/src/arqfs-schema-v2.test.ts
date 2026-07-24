import { describe, expect, it } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { migrateArqfsSchemaV1ToV2 } from './arqfs-schema-v2';

describe('schema v2 migration', () => {
  it('adds provenance/import tables without replacing v1 content', () => {
    const driver = createNodeArqfsDriver(':memory:');
    try {
      createArqfsSchemaV1(driver);
      const result = migrateArqfsSchemaV1ToV2(driver, 1);
      expect(result).toEqual({ status: 'migrated', from: 1, to: 2 });
      expect(driver.pragma('user_version')).toBe(2);
      const tables = driver
        .query<{ readonly name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .map((row) => row.name);
      expect(tables).toContain('source_document');
      expect(tables).toContain('import_session');
      expect(tables).toContain('archive_entry');
    } finally {
      driver.close();
    }
  });
});
