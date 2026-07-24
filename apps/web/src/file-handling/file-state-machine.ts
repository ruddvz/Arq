/**
 * The "open a file" flow's own state, from the moment a user picks/drops a file
 * through native-open, import-with-review, or safe-mode - one pure reducer so
 * the whole flow (acquire -> detect -> route -> [import review] -> commit) has
 * a single source of truth apps/web's UI can render against, rather than ad
 * hoc component state scattered across the picker/dialog/progress views.
 * `routeBrowserFile` (route-file.ts) and @arq/file-ingress/@arq/arqfs supply
 * the real detection/import/open logic this state machine only sequences.
 */
export type FileFlowState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'acquiring'; readonly name: string }
  | { readonly kind: 'detecting'; readonly name: string }
  | { readonly kind: 'native-opening'; readonly name: string }
  | { readonly kind: 'import-options'; readonly name: string; readonly formatId: string }
  | {
      readonly kind: 'importing';
      readonly name: string;
      readonly requestId: string;
      readonly fraction: number;
    }
  | { readonly kind: 'staged-review'; readonly name: string; readonly requestId: string }
  | { readonly kind: 'migrating'; readonly name: string; readonly fraction: number }
  | { readonly kind: 'read-only-safe-mode'; readonly name: string; readonly reason: string }
  | {
      readonly kind: 'failed';
      readonly name?: string;
      readonly code: string;
      readonly message: string;
    };

export type FileFlowEvent =
  | { readonly type: 'acquire'; readonly name: string }
  | { readonly type: 'acquired' }
  | { readonly type: 'route-native' }
  | { readonly type: 'route-import'; readonly formatId: string }
  | { readonly type: 'import-start'; readonly requestId: string }
  | { readonly type: 'progress'; readonly fraction: number }
  | { readonly type: 'staged' }
  | { readonly type: 'safe-mode'; readonly reason: string }
  | { readonly type: 'fail'; readonly code: string; readonly message: string }
  | { readonly type: 'reset' };

export function reduceFileFlow(state: FileFlowState, event: FileFlowEvent): FileFlowState {
  if (event.type === 'reset') return { kind: 'idle' };
  if (event.type === 'acquire') return { kind: 'acquiring', name: event.name };
  if (event.type === 'fail') {
    return {
      kind: 'failed',
      ...('name' in state ? { name: state.name } : {}),
      code: event.code,
      message: event.message,
    };
  }
  if (event.type === 'safe-mode' && 'name' in state) {
    return { kind: 'read-only-safe-mode', name: state.name, reason: event.reason };
  }
  if (state.kind === 'acquiring' && event.type === 'acquired') {
    return { kind: 'detecting', name: state.name };
  }
  if (state.kind === 'detecting' && event.type === 'route-native') {
    return { kind: 'native-opening', name: state.name };
  }
  if (state.kind === 'detecting' && event.type === 'route-import') {
    return { kind: 'import-options', name: state.name, formatId: event.formatId };
  }
  if (state.kind === 'import-options' && event.type === 'import-start') {
    return { kind: 'importing', name: state.name, requestId: event.requestId, fraction: 0 };
  }
  if (state.kind === 'importing' && event.type === 'progress') {
    return { ...state, fraction: Math.max(0, Math.min(1, event.fraction)) };
  }
  if (state.kind === 'importing' && event.type === 'staged') {
    return { kind: 'staged-review', name: state.name, requestId: state.requestId };
  }
  return state;
}
