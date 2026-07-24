import {
  AdapterRegistry,
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

export function createImportWorkerHandler(dependencies: ImportWorkerDependencies) {
  const active = new Map<string, AbortController>();

  return async (
    request: ImportWorkerRequest,
    post: (response: ImportWorkerResponse, transfer?: Transferable[]) => void,
  ): Promise<void> => {
    if (request.type === 'cancel') {
      active.get(request.requestId)?.abort();
      post({ type: 'cancelled', requestId: request.requestId });
      return;
    }

    const controller = new AbortController();
    active.set(request.requestId, controller);
    try {
      const bytes = new Uint8Array(request.bytes);
      if (request.type === 'detect') {
        post({
          type: 'detected',
          requestId: request.requestId,
          candidates: detectFormat(bytes, request.source),
        });
        return;
      }

      const format = formatById(request.formatId);
      if (!format || format.id === 'arq-native') {
        throw new Error('Native Arq files use the direct open path.');
      }
      if (format.adapterId !== request.adapterId && request.adapterId !== 'attachment') {
        throw new Error('Adapter does not match detected format route.');
      }
      const adapter = dependencies.adapters.get(request.adapterId);
      if (!adapter) throw new Error(`Adapter unavailable: ${request.adapterId}`);

      const sourceSha256 = await sha256Hex(bytes);
      if (request.expectedSourceSha256 && request.expectedSourceSha256 !== sourceSha256) {
        throw new Error('Source hash changed between acquisition and conversion.');
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
      post({ type: 'converted', requestId: request.requestId, result }, [...new Set(transfer)]);
    } catch (error) {
      if (controller.signal.aborted) {
        post({ type: 'cancelled', requestId: request.requestId });
      } else {
        post({
          type: 'failed',
          requestId: request.requestId,
          code: 'IMPORT_WORKER_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      active.delete(request.requestId);
    }
  };
}
