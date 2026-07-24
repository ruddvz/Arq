import type { ArqfsDriver } from './arqfs-driver';

/** Matches arqfs-schema-v2.ts's resource_reference.owner_kind CHECK constraint. */
export type ArqfsResourceReferenceOwnerKind =
  'source-document' | 'model-element' | 'view' | 'sheet' | 'preview' | 'import-session';

export interface ResourceReferenceRecord {
  readonly resourceSha256: string;
  readonly ownerKind: ArqfsResourceReferenceOwnerKind;
  readonly ownerId: string;
  readonly role: string;
}

/**
 * FP-014: records that a content-addressed resource (arqfs-resource-chunks.ts) is
 * owned by a given (ownerKind, ownerId, role) - the data a future orphan-cleanup
 * pass needs to tell "still referenced" from "safe to delete" without guessing.
 * Idempotent by design, matching putResource's own discipline: recording the same
 * reference twice is a no-op, not a UNIQUE constraint failure, since the same
 * owner genuinely re-declaring the same reference (e.g. re-running an import) is
 * a real, expected caller behaviour, not a conflict.
 */
export function putResourceReference(driver: ArqfsDriver, record: ResourceReferenceRecord): void {
  driver.run(
    `INSERT INTO resource_reference (resource_sha256, owner_kind, owner_id, role)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (resource_sha256, owner_kind, owner_id, role) DO NOTHING`,
    [record.resourceSha256, record.ownerKind, record.ownerId, record.role],
  );
}

export function putResourceReferences(
  driver: ArqfsDriver,
  records: readonly ResourceReferenceRecord[],
): void {
  driver.transaction(() => {
    for (const record of records) putResourceReference(driver, record);
  });
}

export function listResourceReferences(
  driver: ArqfsDriver,
  resourceSha256: string,
): readonly ResourceReferenceRecord[] {
  const rows = driver.query<{
    readonly resource_sha256: string;
    readonly owner_kind: ArqfsResourceReferenceOwnerKind;
    readonly owner_id: string;
    readonly role: string;
  }>(
    'SELECT resource_sha256, owner_kind, owner_id, role FROM resource_reference WHERE resource_sha256 = ?',
    [resourceSha256],
  );
  return rows.map((row) => ({
    resourceSha256: row.resource_sha256,
    ownerKind: row.owner_kind,
    ownerId: row.owner_id,
    role: row.role,
  }));
}

/** The actual "is this resource still referenced by anything" check a future cleanup pass needs. */
export function isResourceOrphaned(driver: ArqfsDriver, resourceSha256: string): boolean {
  return listResourceReferences(driver, resourceSha256).length === 0;
}
