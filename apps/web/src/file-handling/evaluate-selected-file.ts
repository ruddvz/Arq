import { preflightArqfsBytes, type ArqfsBytePreflightResult } from '@arq/arqfs/src/arqfs-preflight';
import { routeBrowserFile, type BrowserFileRoute } from './route-file';

/**
 * UI-011: the byte-safe compatibility gate a file must pass before this app
 * treats it as an openable Arq project - the missing half of ARQFS-001, which
 * `arqfs-preflight.ts` itself already implemented and tested but nothing in
 * this repository ever called from a real file-open path.
 *
 * Deliberately imports `arqfs-preflight` by its own file path, not
 * `@arq/arqfs`'s package barrel: the barrel also re-exports
 * `arqfs-node-driver.ts` and `arqfs-node-atomic-swap.ts`, both of which import
 * `better-sqlite3` (a native Node addon) and `node:fs` at module scope. A
 * browser bundle must never even attempt to resolve those - this file only
 * needs the pure, driver-free byte-preflight logic, and importing it
 * specifically keeps the Node-only modules out of the dependency graph Vite
 * ever walks for this bundle, rather than depending on tree-shaking to notice
 * they are unused.
 */
export interface EvaluatedFile {
  readonly route: BrowserFileRoute;
  /** Only meaningful when `route.kind === 'open-native-arq'` - the deeper, whole-file gate `routeBrowserFile`'s own lighter header check does not run. */
  readonly preflight?: ArqfsBytePreflightResult;
}

export function evaluateSelectedFile(
  bytes: Uint8Array,
  name: string,
  mediaTypeHint?: string,
): EvaluatedFile {
  const route = routeBrowserFile(bytes, name, mediaTypeHint);
  if (route.kind !== 'open-native-arq') {
    return { route };
  }
  return { route, preflight: preflightArqfsBytes(bytes) };
}
