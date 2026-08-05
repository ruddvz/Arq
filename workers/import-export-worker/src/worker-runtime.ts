import { IMPORT_REJECTION_CODES } from '@arq/file-ingress';
import { createDefaultIngressRegistry } from './default-registry';
import { createImportWorkerHandler } from './handler';
import {
  importCorrelationIdOf,
  parseImportWorkerRequest,
  type ImportWorkerResponse,
} from './protocol';

interface WorkerScopeLike {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: ImportWorkerResponse, transfer?: Transferable[]): void;
}

const handler = createImportWorkerHandler({ adapters: createDefaultIngressRegistry() });

export function installImportExportWorker(scope: WorkerScopeLike): void {
  scope.addEventListener('message', (event) => {
    // V3-021. Parsed, not annotated - `event.data` is whatever the other context
    // posted. The listener's parameter was typed `MessageEvent<ImportWorkerRequest>`,
    // which made the value look checked without anything having checked it.
    const request = parseImportWorkerRequest(event.data);
    if (request === null) {
      const requestId = importCorrelationIdOf(event.data);
      // No usable id means nothing to correlate a refusal against, and refusing
      // under an invented one would settle some other request. Silence leaves
      // only this caller to time out, which is the smaller harm.
      if (requestId !== null) {
        scope.postMessage({
          type: 'failed',
          requestId,
          code: IMPORT_REJECTION_CODES.malformedRequest,
          message:
            'This request is not a shape the import worker protocol defines. Nothing was attempted.',
        });
      }
      return;
    }
    void handler(request, (response, transfer = []) => scope.postMessage(response, transfer));
  });
}
