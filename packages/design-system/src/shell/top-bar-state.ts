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

/**
 * `no-project` exists because every other member of this union asserts something
 * about a project's stored state, and a shell with no project open cannot
 * truthfully assert any of them - least of all `saved`, which claims a save
 * happened. Without it a caller has no honest value to pass, which is exactly
 * how apps/web ended up hard-coding `saved` while no save pipeline existed at
 * all (section 118 / this repository's "no fake state in a production surface"
 * rule).
 */
/**
 * `read-only` exists for the same reason `no-project` does, one boundary further
 * on. Once a native `.arq` project can actually be opened, a shell showing one
 * has a project - so `no-project` is false - but nothing is being saved, because
 * this build does not author an opened `.arq` project at all. Every other member
 * would be a claim about a save that did not happen, and `saved` in particular
 * would say "Saved locally" over a file this build has not written a byte to.
 */
export type SaveState =
  'no-project' | 'read-only' | 'saved' | 'saving' | 'unsaved-changes' | 'recovered';

/**
 * `not-configured` exists for the same reason `no-project` does above: without
 * it, a build with no sync backend at all has no honest value to pass, and
 * apps/web hard-coded `offline` instead. The two are different claims. The
 * governed vocabulary (docs/product/voice/state-language-map.json, machine
 * `sync`) separates them precisely: `offline` explains "Remote sync cannot
 * run", which tells a user a sync feature exists and is currently unreachable
 * - so they may reasonably wait for it, or worry their work is stranded.
 * `not-configured` explains "No remote sync is configured", which is the true
 * statement about this product today.
 */
export type SyncState = 'not-configured' | 'synced' | 'syncing' | 'offline' | 'sync-error';

/**
 * Section 126 ("Baseline"): "status not colour-only" - always a real word, never
 * a colour swatch alone.
 *
 * The labels name the persistence tier. `Saved` on its own reads as "the project
 * file was written", which no current save path does: the shell persists to a
 * local target, not to a portable `.arq` file. The language system's save
 * machine (docs/product/voice/state-language-map.json) fixes these labels, and
 * ui-state-adapter-map.json binds this union's states to their canonical
 * messages.
 */
export function describeSaveState(state: SaveState): string {
  switch (state) {
    case 'no-project':
      return 'No project open';
    case 'read-only':
      // Names the absence of a save rather than a save state, so it cannot be
      // read as either a completed save or a failed one.
      return 'Read-only · nothing to save';
    case 'saved':
      return 'Saved locally';
    case 'saving':
      return 'Saving locally…';
    case 'unsaved-changes':
      return 'Unsaved changes';
    case 'recovered':
      return 'Recovered locally';
  }
}

export function describeSyncState(state: SyncState): string {
  switch (state) {
    // Verbatim from the governed `sync` machine, so the shell and the language
    // registry cannot drift into two different words for one state.
    case 'not-configured':
      return 'Sync not configured';
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
