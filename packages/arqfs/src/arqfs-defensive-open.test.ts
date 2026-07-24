import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { applyDefensiveOpenPolicy } from './arqfs-defensive-open';
import type { ArqfsDriver } from './arqfs-driver';

describe('applyDefensiveOpenPolicy', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  it('disables trusted_schema', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    applyDefensiveOpenPolicy(driver, { readOnly: false });
    expect(driver.pragma('trusted_schema')).toBe(0);
  });

  it('sets a bounded busy_timeout rather than leaving indefinite blocking', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    applyDefensiveOpenPolicy(driver, { readOnly: false });
    expect(driver.pragma('busy_timeout')).toBe(5000);
  });

  it('with readOnly: true, subsequent writes are actually rejected, not merely intended to be', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    applyDefensiveOpenPolicy(driver, { readOnly: true });

    expect(() => driver.exec('CREATE TABLE should_not_be_created (id INTEGER)')).toThrow(
      /readonly/i,
    );
  });

  it('without readOnly, writes still succeed (not read-only by default)', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    applyDefensiveOpenPolicy(driver, { readOnly: false });

    expect(() => driver.exec('CREATE TABLE should_be_created (id INTEGER)')).not.toThrow();
  });

  it("SQLite's own default build already rejects load_extension() as a SQL function - verified directly, not assumed", () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    expect(() => driver.query("SELECT load_extension('anything')")).toThrow(/not authorized/i);
  });
});
