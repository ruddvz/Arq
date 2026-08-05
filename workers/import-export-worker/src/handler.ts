import {
  AdapterRegistry,
  IMPORT_REJECTION_CODES,
  ImportRejection,
  importRejectionCode,
  deserialiseImportPolicy,
  detectFormat,
  executeAdapter,
  formatById,
  sha256Hex,
} from '@arq/file-ingress';
import type { ImportWorkerRequest, ImportWorkerResponse } from './protocol';

export interface ImportWorkerDependencies {
  readonly adapters: AdapterRegistry;
}

/**
 * FP-019: a cancel can arrive after an adapter's `convert()` has already
 * passed its one abort check and is going to settle anyway (today's
 * adapters do all their work synchronously inside one `async` call, so
 * there is no later checkpoint for them to notice the abort). Without
 * `cancelledRequestIds`, that late settlement would still post a second,
 * final message (`'converted'`/`'failed'`) for a request the caller was
 * already told is `'cancelled'` - a real race, not a hypothetical one.
 * Once a request is cancelled, its outcome is `'cancelled'` permanently;
 * any later settlement of the same requestId is silently dropped instead
 * of posted.
 */
export function createImportWorkerHandler(dependencies: ImportWorkerDependencies) {
  const active = new Map<string, AbortController>();
  const cancelledRequestIds = new Set<string>();

  return async (
    request: ImportWorkerRequest,
    post: (response: ImportWorkerResponse, transfer?: Transferable[]) => void,
  ): Promise<void> => {
    if (request.type === 'cancel') {
      const controller = active.get(request.requestId);
      controller?.abort();
      if (controller !== undefined) {
        // V3-029. Only a request that is actually in flight can settle late, so
        // only that one needs suppressing. Remembering every cancelled id grew
        // the set without bound in a long-lived worker, and left a trap: if an
        // id were ever reused, the stale entry would silently swallow the new
        // request's final message and the caller would never hear back.
        cancelledRequestIds.add(request.requestId);
      }
      post({ type: 'cancelled', requestId: request.requestId });
      return;
    }

    const controller = new AbortController();
    active.set(request.requestId, controller);

    function postFinal(response: ImportWorkerResponse, transfer?: Transferable[]): void {
      if (cancelledRequestIds.has(request.requestId)) {
        return;
      }
      if (transfer) {
        post(response, transfer);
      } else {
        post(response);
      }
    }

    try {
      const bytes = new Uint8Array(request.bytes);
      if (request.type === 'detect') {
        postFinal({
          type: 'detected',
          requestId: request.requestId,
          candidates: detectFormat(bytes, request.source),
        });
        return;
      }

      const format = formatById(request.formatId);
      if (!format || format.id === 'arq-native') {
        throw new ImportRejection(
          IMPORT_REJECTION_CODES.nativeFileMisrouted,
          'Native Arq files use the direct open path.',
        );
      }
      if (format.adapterId !== request.adapterId && request.adapterId !== 'attachment') {
        throw new ImportRejection(
          IMPORT_REJECTION_CODES.adapterRouteMismatch,
          'Adapter does not match detected format route.',
        );
      }
      const adapter = dependencies.adapters.get(request.adapterId);
      if (!adapter)
        throw new ImportRejection(
          IMPORT_REJECTION_CODES.adapterUnavailable,
          `Adapter unavailable: ${request.adapterId}`,
        );

      const sourceSha256 = await sha256Hex(bytes);
      if (request.expectedSourceSha256 && request.expectedSourceSha256 !== sourceSha256) {
        // The bytes changed underneath an import already in progress. This must
        // not reach the caller wearing the same code as a configuration
        // mistake: one is worth warning about and the other is worth retrying.
        throw new ImportRejection(
          IMPORT_REJECTION_CODES.sourceDigestChanged,
          'Source hash changed between acquisition and conversion.',
        );
      }

      const result = await executeAdapter({
        adapter,
        bytes,
        source: request.source,
        sourceSha256,
        policy: deserialiseImportPolicy(request.policy),
        signal: controller.signal,
        onProgress: (progress) =>
          post({ type: 'progress', requestId: request.requestId, progress }),
      });
      const transfer = result.resources
        .map((item) => item.bytes.buffer)
        .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
      postFinal({ type: 'converted', requestId: request.requestId, result }, [
        ...new Set(transfer),
      ]);
    } catch (error) {
      if (controller.signal.aborted) {
        postFinal({ type: 'cancelled', requestId: request.requestId });
      } else {
        postFinal({
          type: 'failed',
          requestId: request.requestId,
          // V3-031. An error nobody classified keeps the generic code, which is
          // honest: it is one nobody has decided how to handle.
          code: importRejectionCode(error, 'IMPORT_WORKER_FAILED'),
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      active.delete(request.requestId);
      cancelledRequestIds.delete(request.requestId);
    }
  };
}
