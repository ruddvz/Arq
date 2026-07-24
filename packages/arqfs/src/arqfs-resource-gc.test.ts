import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { putResource, assembleResource } from './arqfs-resource-chunks';
import { putResourceReference } from './arqfs-resource-reference';
import { planOrphanedResources, collectOrphanedResources } from './arqfs-resource-gc';
import type { ArqfsDriver } from './arqfs-driver';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('arqfs-resource-gc (reference-aware collection)', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshV2Driver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaLatest(driver, createArqfsSchemaV1);
    return driver;
  }

  async function putTexture(d: ArqfsDriver, content: string): Promise<string> {
    const { sha256 } = await putResource(d, bytes(content), 'image/png', 'user-texture', 1024);
    return sha256;
  }

  /**
   * Schema v1 has no `resource_reference` table, so "unreferenced" cannot be
   * computed there at all. Reporting that as `unsupported` keeps a v1 file from
   * being told everything is garbage.
   */
  it('refuses to collect on schema v1 instead of treating every resource as orphaned', async () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    await putTexture(driver, 'v1 texture');

    expect(planOrphanedResources(driver)).toEqual({
      status: 'unsupported',
      reason: 'resource garbage collection requires schema v2 resource references',
    });
    expect(collectOrphanedResources(driver).status).toBe('unsupported');
  });

  it('plans only unreferenced resources and does not delete during planning', async () => {
    const d = freshV2Driver();
    const referenced = await putTexture(d, 'referenced texture');
    const orphan = await putTexture(d, 'orphan texture');

    putResourceReference(d, {
      resourceSha256: referenced,
      ownerKind: 'model-element',
      ownerId: 'wall-1',
      role: 'material',
    });

    const plan = planOrphanedResources(d);
    expect(plan.status).toBe('ready');
    expect(plan.status === 'ready' ? plan.resources.map((r) => r.sha256) : []).toEqual([orphan]);

    // Planning is a preview: both resources are still readable afterwards.
    expect((await assembleResource(d, orphan)).status).toBe('assembled');
    expect((await assembleResource(d, referenced)).status).toBe('assembled');
  });

  it('collects the orphan, frees its bytes and leaves the referenced resource intact', async () => {
    const d = freshV2Driver();
    const referenced = await putTexture(d, 'referenced texture');
    const orphan = await putTexture(d, 'orphan texture');
    putResourceReference(d, {
      resourceSha256: referenced,
      ownerKind: 'model-element',
      ownerId: 'wall-1',
      role: 'material',
    });

    const result = collectOrphanedResources(d);

    expect(result.status).toBe('collected');
    if (result.status !== 'collected') return;
    expect(result.resources.map((r) => r.sha256)).toEqual([orphan]);
    expect(result.bytesFreed).toBe(bytes('orphan texture').byteLength);

    expect(await assembleResource(d, orphan)).toEqual({
      status: 'rejected',
      reason: 'unknown resource',
    });
    expect((await assembleResource(d, referenced)).status).toBe('assembled');
    // Chunks must go with the resource - v1's foreign key intentionally has no cascade.
    expect(d.query('SELECT 1 FROM resource_chunk WHERE resource_sha256 = ?', [orphan])).toEqual([]);
  });

  it('is a no-op when every resource is still referenced', async () => {
    const d = freshV2Driver();
    const referenced = await putTexture(d, 'referenced texture');
    putResourceReference(d, {
      resourceSha256: referenced,
      ownerKind: 'sheet',
      ownerId: 'sheet-1',
      role: 'underlay',
    });

    expect(collectOrphanedResources(d)).toEqual({
      status: 'collected',
      resources: [],
      bytesFreed: 0,
    });
    expect((await assembleResource(d, referenced)).status).toBe('assembled');
  });

  it('honours maxResources so a large cleanup can be performed in bounded batches', async () => {
    const d = freshV2Driver();
    await putTexture(d, 'orphan one');
    await putTexture(d, 'orphan two');
    await putTexture(d, 'orphan three');

    const first = collectOrphanedResources(d, { maxResources: 2 });
    expect(first.status === 'collected' ? first.resources.length : -1).toBe(2);

    const remaining = planOrphanedResources(d);
    expect(remaining.status === 'ready' ? remaining.resources.length : -1).toBe(1);
  });

  it('rejects an invalid batch size rather than silently collecting everything', async () => {
    const d = freshV2Driver();
    await putTexture(d, 'orphan');

    expect(collectOrphanedResources(d, { maxResources: -1 })).toEqual({
      status: 'rejected',
      reason: 'maxResources must be a non-negative integer',
    });
    expect(planOrphanedResources(d).status).toBe('ready');
  });

  /**
   * A reference added after the plan was computed must win. Collection re-checks
   * each resource inside the transaction, so a resource that became referenced in
   * the meantime is skipped rather than deleted out from under its new owner.
   */
  it('skips a resource that gained a reference between planning and deletion', async () => {
    const d = freshV2Driver();
    const sha256 = await putTexture(d, 'about to be referenced');

    expect(planOrphanedResources(d).status).toBe('ready');
    putResourceReference(d, {
      resourceSha256: sha256,
      ownerKind: 'view',
      ownerId: 'view-1',
      role: 'underlay',
    });

    const result = collectOrphanedResources(d);
    expect(result).toEqual({ status: 'collected', resources: [], bytesFreed: 0 });
    expect((await assembleResource(d, sha256)).status).toBe('assembled');
  });
});
