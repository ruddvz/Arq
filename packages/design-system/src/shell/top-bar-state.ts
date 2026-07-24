/**
 * ARQ-023: build top bar.
 *
 * Blueprint section 12 ("Desktop shell") > "Top application bar": Arq mark,
 * project name, undo, redo, local save state, cloud sync state, active view,
 * share, command search, account menu. Section rules: "save and sync must be
 * separate concepts" (SaveState and SyncState below are deliberately two
 * separate unions, never merged into one status enum); "network failure must
 * not present as local data loss" (a SyncState of 'offline'/'sync-error'
 * carries no implication about SaveState - a project can be fully saved
 * locally while sync is offline or erroring).
 *
 * Non-goals (top-bar.tsx is the "shell" only, per the issue title): a real
 * command-search results list (that is the command palette shell, ARQ-029,
 * which top-bar.tsx opens but does not implement), a real account-menu
 * dropdown (no auth exists yet), and branch/design-option switching
 * ("later" per the blueprint's own bullet list).
 */

export type SaveState = 'saved' | 'saving' | 'unsaved-changes' | 'recovered';
export type SyncState = 'synced' | 'syncing' | 'offline' | 'sync-error';

/** Section 126 ("Baseline"): "status not colour-only" - always a real word, never a colour swatch alone. */
export function describeSaveState(state: SaveState): string {
  switch (state) {
    case 'saved':
      return 'Saved';
    case 'saving':
      return 'Saving…';
    case 'unsaved-changes':
      return 'Unsaved changes';
    case 'recovered':
      return 'Recovered';
  }
}

export function describeSyncState(state: SyncState): string {
  switch (state) {
    case 'synced':
      return 'Synced';
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return 'Offline';
    case 'sync-error':
      return 'Sync error';
  }
}

export interface TopBarUndoRedoState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * Section 12 rule: "undo and redo show the action name in tooltip." Returns
 * null (no tooltip, and the caller should disable the control) when there is
 * nothing to undo or the caller has no label for it - never a placeholder
 * string like "Undo" with no action named.
 */
export function undoTooltip(
  state: TopBarUndoRedoState,
  lastUndoActionLabel: string | null,
): string | null {
  if (!state.canUndo || lastUndoActionLabel === null) {
    return null;
  }
  return `Undo ${lastUndoActionLabel}`;
}

export function redoTooltip(
  state: TopBarUndoRedoState,
  lastRedoActionLabel: string | null,
): string | null {
  if (!state.canRedo || lastRedoActionLabel === null) {
    return null;
  }
  return `Redo ${lastRedoActionLabel}`;
}

/**
 * Section 12 rule: "project title editing is inline but reversible." A
 * proposed rename commits only on Enter or blur-with-changes; Escape (or
 * blur with the value unchanged) must restore `currentName` exactly - this
 * function is that one decision, kept separate from any DOM event handling
 * so it can be tested without a component.
 */
export function resolveProjectNameEdit(
  currentName: string,
  proposedName: string,
  committed: boolean,
): string {
  if (!committed) {
    return currentName;
  }
  const trimmed = proposedName.trim();
  return trimmed.length === 0 ? currentName : trimmed;
}
