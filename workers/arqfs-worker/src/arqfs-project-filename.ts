// Deep import for the same reason as arqfs-worker-entry.ts: the `@arq/arqfs`
// barrel reaches `better-sqlite3` through `arqfs-node-driver`, which cannot be
// bundled for a browser.
import { validateArqfsProjectId } from '@arq/arqfs/src/arqfs-policy';

/**
 * Where a project's canonical file lives inside this origin's OPFS root. One
 * dedicated Worker per project (ADR-0024) only actually isolates projects if each
 * Worker also opens a project-scoped filename: OPFS storage is shared at the
 * origin, not per-Worker, so two projects opened through the same fixed filename
 * would silently read and write the same underlying file.
 *
 * Pure and side-effect-free on purpose - both `arqfs-worker-entry.ts` (inside the
 * Worker, deriving the filename to open) and a future main-thread Worker-construction
 * call (deriving the URL to construct the Worker with) need this without either
 * loading sqlite-wasm as a side effect of importing it.
 */
const OPFS_PROJECT_DIRECTORY = '/arq-projects';

export function opfsFilenameForProject(projectId: string): string {
  validateArqfsProjectId(projectId);
  return `${OPFS_PROJECT_DIRECTORY}/${projectId}.sqlite3`;
}

/**
 * The query string a dedicated Worker for this project must be constructed with
 * (`new Worker(workerScriptUrl + arqfsWorkerUrlSearch(projectId))`), so
 * `arqfs-worker-entry.ts` can select the right OPFS file before its first request
 * can arrive - reading the project id from a first postMessage instead would leave
 * a window where the Worker exists but has not yet chosen which file it owns.
 */
export function arqfsWorkerUrlSearch(projectId: string): string {
  validateArqfsProjectId(projectId);
  return `?project=${encodeURIComponent(projectId)}`;
}

/** The inverse of `arqfsWorkerUrlSearch` - what `arqfs-worker-entry.ts` reads back out of its own `self.location.search`. */
export function readProjectIdFromWorkerSearch(search: string): string {
  const projectId = new URLSearchParams(search).get('project');
  if (projectId === null) {
    throw new Error(
      'arqfs Worker requires a project id: construct it with "?project=<id>" in its URL',
    );
  }
  validateArqfsProjectId(projectId);
  return projectId;
}

/**
 * The project id a refusal should name when the Worker could not be
 * constructed at all - exactly the case where the id was missing or invalid,
 * so `readProjectIdFromWorkerSearch` would throw a second time and lose the
 * original construction error. Every response carries a project id,
 * including this one: an unknown sender is still a fact worth stating rather
 * than a field silently left off.
 */
export const UNKNOWN_ARQFS_PROJECT_ID = 'unknown';

export function readProjectIdOrUnknown(search: string): string {
  try {
    return readProjectIdFromWorkerSearch(search);
  } catch {
    return UNKNOWN_ARQFS_PROJECT_ID;
  }
}

/**
 * The query string for a Worker that will be handed bytes a user selected
 * instead of owning a project file of its own.
 *
 * It carries no project id because the identity of a selected file is a fact
 * inside that file, not something the caller knows before opening it - and
 * because this Worker must never touch OPFS at all, so there is no filename for
 * an id to select. The mode is in the URL rather than in the first message for
 * the same reason the project id is: a Worker has to know what it is before a
 * request can race it.
 */
export function arqfsSelectedBytesWorkerUrlSearch(): string {
  return `?source=${ARQFS_WORKER_SELECTED_BYTES}`;
}

export const ARQFS_WORKER_SELECTED_BYTES = 'selected-bytes';

/**
 * Which of the two Worker modes this URL asks for. Unrecognised values are an
 * error rather than a fallback: silently treating a typo as the owned-project
 * mode would put a Worker that was meant to be a reader in charge of a file.
 */
export function readWorkerSourceFromSearch(search: string): 'owned-project' | 'selected-bytes' {
  const source = new URLSearchParams(search).get('source');
  if (source === null || source === 'owned-project') {
    return 'owned-project';
  }
  if (source === ARQFS_WORKER_SELECTED_BYTES) {
    return ARQFS_WORKER_SELECTED_BYTES;
  }
  throw new Error(`arqfs Worker does not have a "${source}" source mode`);
}
