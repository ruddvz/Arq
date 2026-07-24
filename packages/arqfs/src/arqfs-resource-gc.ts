import type { ArqfsDriver } from './arqfs-driver';

export interface ArqfsOrphanedResource {
  readonly sha256: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly referenceCount: number;
}

export type ArqfsResourceGcResult =
  | {
      readonly status: 'collected';
      readonly resources: readonly ArqfsOrphanedResource[];
      readonly bytesFreed: number;
    }
  | { readonly status: 'rejected' | 'unsupported'; readonly reason: string };

function hasResourceReferenceTable(driver: ArqfsDriver): boolean {
  return (
    driver.query<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'resource_reference'",
    ).length > 0
  );
}

/** Lists resources with no v2 owner reference. This is read-only and safe to show as a preview. */
export function planOrphanedResources(
  driver: ArqfsDriver,
):
  | { readonly status: 'ready'; readonly resources: readonly ArqfsOrphanedResource[] }
  | { readonly status: 'unsupported'; readonly reason: string } {
  try {
    if (!hasResourceReferenceTable(driver)) {
      return {
        status: 'unsupported',
        reason: 'resource garbage collection requires schema v2 resource references',
      };
    }
    const rows = driver.query<{
      readonly sha256: string;
      readonly media_type: string;
      readonly byte_length: number;
      readonly reference_count: number;
    }>(
      `SELECT r.sha256, r.media_type, r.byte_length, COUNT(rr.resource_sha256) AS reference_count
         FROM resource r
         LEFT JOIN resource_reference rr ON rr.resource_sha256 = r.sha256
        GROUP BY r.sha256, r.media_type, r.byte_length
        HAVING COUNT(rr.resource_sha256) = 0
        ORDER BY r.sha256`,
    );
    return {
      status: 'ready',
      resources: rows.map((row) => ({
        sha256: row.sha256,
        mediaType: row.media_type,
        byteLength: Number(row.byte_length),
        referenceCount: Number(row.reference_count),
      })),
    };
  } catch (error) {
    return {
      status: 'unsupported',
      reason: `resource garbage collection could not inspect the file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Deletes only resources that are still unreferenced at deletion time. Chunks are
 * removed first because v1's foreign key intentionally has no cascade. The caller
 * should run this only after presenting the plan to a user or a background quota
 * policy; there is no hidden, automatic deletion.
 */
export function collectOrphanedResources(
  driver: ArqfsDriver,
  options: { readonly maxResources?: number } = {},
): ArqfsResourceGcResult {
  const planned = planOrphanedResources(driver);
  if (planned.status === 'unsupported') return planned;
  const maxResources = options.maxResources ?? planned.resources.length;
  if (!Number.isSafeInteger(maxResources) || maxResources < 0) {
    return { status: 'rejected', reason: 'maxResources must be a non-negative integer' };
  }
  const selected = planned.resources.slice(0, maxResources);
  try {
    driver.transaction(() => {
      for (const resource of selected) {
        const stillUnreferenced = driver.query<{ readonly count: number }>(
          'SELECT COUNT(*) AS count FROM resource_reference WHERE resource_sha256 = ?',
          [resource.sha256],
        )[0];
        if (Number(stillUnreferenced?.count ?? 0) !== 0) continue;
        driver.run('DELETE FROM resource_chunk WHERE resource_sha256 = ?', [resource.sha256]);
        driver.run('DELETE FROM resource WHERE sha256 = ?', [resource.sha256]);
      }
    });
  } catch (error) {
    return { status: 'rejected', reason: error instanceof Error ? error.message : String(error) };
  }
  let removed: readonly ArqfsOrphanedResource[];
  try {
    removed = selected.filter(
      (resource) =>
        Number(
          driver.query<{ readonly count: number }>(
            'SELECT COUNT(*) AS count FROM resource WHERE sha256 = ?',
            [resource.sha256],
          )[0]?.count ?? 0,
        ) === 0,
    );
  } catch (error) {
    return { status: 'rejected', reason: error instanceof Error ? error.message : String(error) };
  }
  return {
    status: 'collected',
    resources: removed,
    bytesFreed: removed.reduce((sum, resource) => sum + resource.byteLength, 0),
  };
}
