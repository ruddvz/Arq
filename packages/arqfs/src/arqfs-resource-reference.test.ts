import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { putResource } from './arqfs-resource-chunks';
import {
  putResourceReference,
  putResourceReferences,
  listResourceReferences,
  isResourceOrphaned,
} from './arqfs-resource-reference';
import type { ArqfsDriver } from './arqfs-driver';

describe('arqfs-resource-reference', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaLatest(driver, createArqfsSchemaV1);
    return driver;
  }

  it('records a reference and reads it back', async () => {
    const d = freshDriver();
    const { sha256 } = await putResource(
      d,
      new TextEncoder().encode('texture bytes'),
      'image/png',
      'user-texture',
      1000,
    );

    putResourceReference(d, {
      resourceSha256: sha256,
      ownerKind: 'model-element',
      ownerId: 'wall-1',
      role: 'material',
    });

    const refs = listResourceReferences(d, sha256);
    expect(refs).toEqual([
      { resourceSha256: sha256, ownerKind: 'model-element', ownerId: 'wall-1', role: 'material' },
    ]);
  });

  it('recording the same reference twice is idempotent, not a UNIQUE constraint error', async () => {
    const d = freshDriver();
    const { sha256 } = await putResource(
      d,
      new TextEncoder().encode('shared texture'),
      'image/png',
      'user-texture',
      1000,
    );
    const record = {
      resourceSha256: sha256,
      ownerKind: 'model-element' as const,
      ownerId: 'wall-1',
      role: 'material',
    };

    putResourceReference(d, record);
    putResourceReference(d, record);

    expect(listResourceReferences(d, sha256)).toHaveLength(1);
  });

  it('putResourceReferences records several references for a resource in one transaction', async () => {
    const d = freshDriver();
    const { sha256 } = await putResource(
      d,
      new TextEncoder().encode('preview image'),
      'image/png',
      'portable-preview',
      1000,
    );

    putResourceReferences(d, [
      { resourceSha256: sha256, ownerKind: 'view', ownerId: 'view-1', role: 'thumbnail' },
      { resourceSha256: sha256, ownerKind: 'sheet', ownerId: 'sheet-1', role: 'thumbnail' },
    ]);

    expect(listResourceReferences(d, sha256)).toHaveLength(2);
  });

  it('a resource with zero references is correctly reported as orphaned', async () => {
    const d = freshDriver();
    const { sha256 } = await putResource(
      d,
      new TextEncoder().encode('unreferenced'),
      'application/octet-stream',
      'user-texture',
      1000,
    );

    expect(isResourceOrphaned(d, sha256)).toBe(true);

    putResourceReference(d, {
      resourceSha256: sha256,
      ownerKind: 'preview',
      ownerId: 'preview-1',
      role: 'thumbnail',
    });

    expect(isResourceOrphaned(d, sha256)).toBe(false);
  });
});
