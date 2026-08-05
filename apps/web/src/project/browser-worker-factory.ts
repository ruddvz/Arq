/**
 * Constructs the real Arq Worker for one project, in a browser.
 *
 * Split from `open-native-project.ts` so that pipeline stays testable in Node:
 * this is the only part that needs `new Worker` and Vite's asset rewriting, and
 * it has no logic worth unit-testing beyond what a real browser run can verify.
 *
 * Imported as `?worker&url` rather than constructed through
 * `new Worker(new URL(...))`. The difference matters: the project id has to
 * travel in the Worker's own URL, because the entry point reads it from
 * `self.location.search` before serving any request, and a `new URL(...)`
 * expression must stay statically analysable for Vite to bundle the worker at
 * all - so there is nowhere to put the query. `?worker&url` yields the built
 * worker's URL as a string, which can carry one.
 *
 * The id must reach the Worker through its URL rather than a first postMessage
 * because OPFS is shared per origin, not per Worker: two projects opened through
 * one fixed filename would silently read and write the same database, and a
 * first-message handshake leaves a window in which a request could race it.
 */
import workerUrl from '@arq/arqfs-worker/src/arqfs-worker-entry.ts?worker&url';
import { ArqfsWorkerClient } from '@arq/arqfs/src/arqfs-worker-client';
import type { NativeWorkerHandle } from './open-native-project';

export function createBrowserArqfsWorker(workingCopyId: string): NativeWorkerHandle {
  const worker = new Worker(`${workerUrl}?project=${encodeURIComponent(workingCopyId)}`, {
    type: 'module',
  });
  return { worker, client: new ArqfsWorkerClient(worker) };
}
