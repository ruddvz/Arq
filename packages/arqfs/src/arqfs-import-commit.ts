import type { ArqfsDriver } from './arqfs-driver';
import { runArqfsLocalWrite } from './arqfs-working-copy';
import {
  computeResourceContentDescriptor,
  putResourceDescriptor,
  type ArqfsResourceContentDescriptor,
} from './arqfs-resource-chunks';
import { putResourceReference } from './arqfs-resource-reference';
import {
  putSourceDocument,
  putSourceObjectMappings,
  type SourceDocumentRecord,
  type SourceObjectMapRecord,
} from './arqfs-provenance';
import {
  updateImportSession,
  replaceImportIssues,
  type PersistedImportIssue,
} from './arqfs-import-session';

/**
 * ARQ-4xx: turns a reviewed, staged `@arq/file-ingress` import result into one
 * durable canonical mutation - the "review before commit" and "cancel and failure
 * without partial canonical mutation" half of the schema-v2 import workflow. The
 * conversion, staging and detection themselves already exist and are unchanged
 * (`@arq/file-ingress`'s `executeAdapter`/`prepareImport`, and this repository's
 * per-format adapters); this module is only the missing last step - writing an
 * already-accepted result into the file - which nothing in the repository
 * previously did at all.
 *
 * Deliberately does not create Arq elements from `StagedImportElement`s. Doing so
 * would mean inventing per-format staged-property-to-element-kind mapping rules
 * that do not exist anywhere in this codebase today (every adapter's own staged
 * `kind` is prefixed to say so explicitly, e.g. dxf-ingress-adapter.ts's
 * `dxf-${entity.kind}`, never a bare Arq element kind like `wall`), and there is
 * no live document/model store yet to create them into
 * (`packages/operations/src/create-element-operation.ts`'s own doc comment notes
 * this same gap). `source_object_map.arq_element_id` is nullable precisely so a
 * mapping can be committed honestly as "staged, not yet linked to a committed
 * element" - a future step that actually creates elements (through
 * `packages/operations`' typed CreateElement operations, once a document store
 * exists) is expected to update that column afterwards, not this one.
 */
export interface ArqfsImportSourceInput {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly chunkSize?: number;
}

const DEFAULT_IMPORT_RESOURCE_CHUNK_SIZE = 1024 * 1024;

export interface ArqfsImportCommitInput {
  readonly sessionId: string;
  readonly sourceDocument: Omit<SourceDocumentRecord, 'sourceResourceSha256'>;
  /** Present only when the import policy's `preserveOriginalSource` asked to keep the original bytes. */
  readonly source?: ArqfsImportSourceInput;
  readonly mappings: readonly SourceObjectMapRecord[];
  readonly issues: readonly PersistedImportIssue[];
  readonly reportJson: string;
}

export type ArqfsImportCommitResult =
  | { readonly status: 'committed'; readonly sourceDocumentId: string; readonly revision: number }
  | { readonly status: 'rejected'; readonly reason: string };

/**
 * Hashing happens before the transaction starts (`runArqfsLocalWrite`'s mutation
 * callback is synchronous by design - see arqfs-driver.ts - and cannot itself
 * await a hash); everything that actually mutates the file happens inside exactly
 * one `runArqfsLocalWrite` call, so a failure at any point - resource write,
 * provenance write, mapping write, session update - leaves the file exactly as it
 * was before this call, never half-committed. A caller-supplied `sourceDocument.id`
 * that already exists rejects cleanly (UNIQUE(sha256, original_name) or a bare
 * PRIMARY KEY collision) rather than silently overwriting a previous import.
 */
export async function commitStagedImport(
  driver: ArqfsDriver,
  input: ArqfsImportCommitInput,
): Promise<ArqfsImportCommitResult> {
  let resourceDescriptor: ArqfsResourceContentDescriptor | undefined;
  if (input.source !== undefined) {
    resourceDescriptor = await computeResourceContentDescriptor(
      input.source.bytes,
      input.source.chunkSize ?? DEFAULT_IMPORT_RESOURCE_CHUNK_SIZE,
    );

    // The caller supplies the source fingerprint (`sourceDocument.sha256`/
    // `byteLength`) and the bytes to preserve as two separate inputs. If they
    // disagree, writing both would persist a provenance record that is simply
    // false about the very resource it points at - the exact claim ARQFS-012's
    // "source fingerprint and resource preservation" exists to make trustworthy.
    // Verified against the real hash rather than trusted, since the hash is
    // already computed here anyway.
    if (resourceDescriptor.sha256 !== input.sourceDocument.sha256) {
      return {
        status: 'rejected',
        reason: `source fingerprint mismatch: sourceDocument.sha256 does not match the preserved bytes (expected ${resourceDescriptor.sha256})`,
      };
    }
    if (resourceDescriptor.byteLength !== input.sourceDocument.byteLength) {
      return {
        status: 'rejected',
        reason: `source fingerprint mismatch: sourceDocument.byteLength ${input.sourceDocument.byteLength} does not match the preserved bytes (${resourceDescriptor.byteLength})`,
      };
    }
  }

  const writeResult = runArqfsLocalWrite(driver, () => {
    let sourceResourceSha256: string | undefined;
    if (resourceDescriptor !== undefined && input.source !== undefined) {
      const stored = putResourceDescriptor(
        driver,
        resourceDescriptor,
        input.source.mediaType,
        'source-import',
      );
      sourceResourceSha256 = stored.sha256;
      // Without this, arqfs-resource-gc.ts's reference-aware collection would see
      // a resource with zero rows in resource_reference and delete it, even
      // though source_document's own FK still points at it - GC only understands
      // resource_reference, not every table that might hold a sha256.
      putResourceReference(driver, {
        resourceSha256: sourceResourceSha256,
        ownerKind: 'source-document',
        ownerId: input.sourceDocument.id,
        role: 'source',
      });
    }

    putSourceDocument(driver, {
      ...input.sourceDocument,
      ...(sourceResourceSha256 !== undefined ? { sourceResourceSha256 } : {}),
    });

    if (input.mappings.length > 0) {
      putSourceObjectMappings(driver, input.mappings);
    }

    replaceImportIssues(driver, input.sessionId, input.issues);

    const sessionsUpdated = updateImportSession(driver, input.sessionId, 'committed', {
      sourceDocumentId: input.sourceDocument.id,
      reportJson: input.reportJson,
    });
    // `UPDATE ... WHERE id = ?` against a missing session is a silent SQLite
    // no-op. Without this, a typo'd/stale sessionId still wrote the
    // source_document, resource and mappings and reported 'committed' - the
    // canonical data landed while the session it claimed to commit did not
    // exist. Worse, it only ever failed loudly when `issues` was non-empty
    // (import_issue's FK to import_session), so exactly the clean-import case
    // stayed silent. Throwing here rolls the whole write back.
    if (sessionsUpdated !== 1) {
      throw new Error(`import session ${input.sessionId} does not exist`);
    }
  });

  if (writeResult.status === 'rejected') {
    return { status: 'rejected', reason: writeResult.reason };
  }
  return {
    status: 'committed',
    sourceDocumentId: input.sourceDocument.id,
    revision: writeResult.revision,
  };
}

export interface ArqfsImportSessionUpdateResult<TStatus extends string> {
  readonly status: TStatus | 'rejected';
  readonly reason?: string;
}

/** No resource, provenance or mapping row is ever written for a cancelled import - only the session's own status changes. */
export function cancelStagedImport(
  driver: ArqfsDriver,
  sessionId: string,
): ArqfsImportSessionUpdateResult<'cancelled'> {
  const writeResult = runArqfsLocalWrite(driver, () => {
    // Same silent-no-op hazard as commitStagedImport - see its comment.
    if (updateImportSession(driver, sessionId, 'cancelled') !== 1) {
      throw new Error(`import session ${sessionId} does not exist`);
    }
  });
  if (writeResult.status === 'rejected') {
    return { status: 'rejected', reason: writeResult.reason };
  }
  return { status: 'cancelled' };
}

export interface ArqfsImportFailInput {
  readonly failureCode: string;
  readonly failureMessage: string;
}

/** Records a failed import explicitly, distinct from a cancellation, so a support bundle or diagnostics view can tell "the user stopped it" from "it broke". */
export function failStagedImport(
  driver: ArqfsDriver,
  sessionId: string,
  failure: ArqfsImportFailInput,
): ArqfsImportSessionUpdateResult<'failed'> {
  const writeResult = runArqfsLocalWrite(driver, () => {
    const updated = updateImportSession(driver, sessionId, 'failed', {
      failureCode: failure.failureCode,
      failureMessage: failure.failureMessage,
    });
    // Same silent-no-op hazard as commitStagedImport - see its comment.
    if (updated !== 1) {
      throw new Error(`import session ${sessionId} does not exist`);
    }
  });
  if (writeResult.status === 'rejected') {
    return { status: 'rejected', reason: writeResult.reason };
  }
  return { status: 'failed' };
}
