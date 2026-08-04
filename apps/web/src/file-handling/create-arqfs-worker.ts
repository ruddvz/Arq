// `?worker&url` gives the built Worker script's URL rather than a constructor,
// which is what lets the mode be appended as a query parameter. The mode has to
// travel in the URL: `arqfs-worker-entry.ts` reads it at module scope so the
// Worker knows whether it owns a project file before any request can race it,
// and a constructor import offers nowhere to put it.
import arqfsWorkerScriptUrl from '@arq/arqfs-worker/src/arqfs-worker-entry?worker&url';
import { arqfsSelectedBytesWorkerUrlSearch } from '@arq/arqfs-worker/src/arqfs-project-filename';

/**
 * The one place this application constructs the SQLite Worker.
 *
 * Every open gets its own Worker, and closing a project terminates it. That is
 * not an optimisation left undone: a Worker in selected-bytes mode holds one
 * project's pages in its own heap for its whole life, so reusing it across files
 * would mean either keeping the previous project resident or teaching the Worker
 * to swap connections - which is the ambiguity about "which file is this" that
 * arqfs-worker-entry.ts refuses on purpose.
 */
export function createSelectedBytesArqfsWorker(): Worker {
  return new Worker(`${arqfsWorkerScriptUrl}${arqfsSelectedBytesWorkerUrlSearch()}`, {
    type: 'module',
    name: 'arqfs-selected-bytes',
  });
}
