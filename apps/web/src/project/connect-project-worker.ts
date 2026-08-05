/**
 * The browser half of the open path: constructs the real Arq-owned dedicated
 * Worker for one project and wraps it in the client that correlates its
 * responses. This is the module `apps/web` was missing - `workers/arqfs-worker`
 * has existed and been proven in headless Chromium, and nothing in the product
 * ever built one.
 *
 * Deliberately tiny and browser-only. Everything decidable without a browser -
 * the open sequence, its refusals, its cancellation - lives in
 * `open-native-project.ts` and is tested in Node against the same request
 * handler this Worker runs.
 */
import { ArqfsWorkerClient } from '@arq/arqfs/src/arqfs-worker-client';
import { arqfsWorkerUrlSearch } from '@arq/arqfs-worker/src/arqfs-project-filename';
import type { ProjectWorkerConnection } from './open-native-project';

/**
 * A project id for a file the user just selected.
 *
 * It names an OPFS file, so it has to be a safe filename segment
 * (`validateArqfsProjectId`), and it must not be derived from the file's name:
 * two different files called `house.arq` are two different projects, and reusing
 * the name would open the second one over the first one's storage.
 */
export function newProjectId(): string {
  return `p-${crypto.randomUUID()}`;
}

/**
 * `?project=<id>` goes in the Worker's own URL rather than a first message, so
 * the Worker has already chosen which OPFS file it owns before any request can
 * race it.
 */
export async function connectProjectWorker(projectId: string): Promise<ProjectWorkerConnection> {
  const workerUrl = new URL(
    '../../../../workers/arqfs-worker/src/arqfs-worker-entry.ts',
    import.meta.url,
  );
  workerUrl.search = arqfsWorkerUrlSearch(projectId);
  const worker = new Worker(workerUrl, { type: 'module', name: `arqfs:${projectId}` });
  const client = new ArqfsWorkerClient(worker, { projectId });
  return {
    request: (input, options) => client.request(input, options),
    dispose: (reason) => {
      client.dispose(reason);
      // Terminating is the point: the client stops correlating, but the Worker
      // itself keeps its exclusive OPFS handle on the project file until the
      // thread is gone, and the next open of that project would block on it.
      worker.terminate();
    },
  };
}

/** SHA-256 hex over the selected bytes, used as the working copy's source provenance. */
export async function digestSourceBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
