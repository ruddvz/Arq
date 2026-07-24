import { createDefaultIngressRegistry } from './default-registry';
import { createImportWorkerHandler } from './handler';
import type { ImportWorkerRequest, ImportWorkerResponse } from './protocol';

interface WorkerScopeLike {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ImportWorkerRequest>) => void,
  ): void;
  postMessage(message: ImportWorkerResponse, transfer?: Transferable[]): void;
}

const handler = createImportWorkerHandler({ adapters: createDefaultIngressRegistry() });

export function installImportExportWorker(scope: WorkerScopeLike): void {
  scope.addEventListener('message', (event) => {
    void handler(event.data, (response, transfer = []) => scope.postMessage(response, transfer));
  });
}
