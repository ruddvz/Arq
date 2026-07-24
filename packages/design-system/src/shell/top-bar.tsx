import { useState, type KeyboardEvent } from 'react';
import { Logo } from '../logo';
import {
  describeSaveState,
  describeSyncState,
  resolveProjectNameEdit,
  undoTooltip,
  redoTooltip,
  type SaveState,
  type SyncState,
} from './top-bar-state';

export interface TopBarProps {
  readonly projectName: string;
  readonly onRenameProject: (name: string) => void;
  readonly activeViewName: string;
  readonly saveState: SaveState;
  readonly syncState: SyncState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly lastUndoActionLabel: string | null;
  readonly lastRedoActionLabel: string | null;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onShare: () => void;
  readonly onOpenCommandPalette: () => void;
  readonly onOpenAccountMenu: () => void;
}

/**
 * ARQ-023: build top bar. Blueprint section 12 > "Top application bar" - see
 * top-bar-state.ts for the section's rules and this component's non-goals.
 *
 * States: hover/focus/disabled come from shell-controls.css's shared
 * `.arq-shell-button` (every button below uses it); a native `<button
 * disabled>` is unclickable and unfocusable, matching "destructive pending
 * states must not be hidden inside menus" by keeping undo/redo directly
 * visible (disabled, not removed) rather than tucked away when unavailable.
 * Keyboard: every control is a native button/input, reachable by Tab in
 * document order; Escape/Enter on the project-name input are handled
 * explicitly below (rename is "inline but reversible", section 12).
 * iPad touch: `.arq-shell-button` enforces the 44px minimum touch target
 * (section 121) regardless of pointer type.
 */
export function TopBar(props: TopBarProps): JSX.Element {
  const {
    projectName,
    onRenameProject,
    activeViewName,
    saveState,
    syncState,
    canUndo,
    canRedo,
    lastUndoActionLabel,
    lastRedoActionLabel,
    onUndo,
    onRedo,
    onShare,
    onOpenCommandPalette,
    onOpenAccountMenu,
  } = props;

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);

  function beginEdit(): void {
    setDraftName(projectName);
    setIsEditingName(true);
  }

  function endEdit(committed: boolean): void {
    const resolved = resolveProjectNameEdit(projectName, draftName, committed);
    if (committed && resolved !== projectName) {
      onRenameProject(resolved);
    }
    setIsEditingName(false);
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      endEdit(true);
    } else if (event.key === 'Escape') {
      endEdit(false);
    }
  }

  return (
    <header
      className="arq-top-bar arq-shell-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--arq-space-control-group)',
        padding: 'var(--arq-space-compact) var(--arq-space-panel)',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
      }}
    >
      <Logo variant="symbol" heightPx={24} />

      {isEditingName ? (
        <input
          autoFocus
          aria-label="Project name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => endEdit(true)}
          onKeyDown={handleNameKeyDown}
        />
      ) : (
        <button
          type="button"
          className="arq-shell-button"
          aria-label={`Project name: ${projectName}. Activate to rename.`}
          onClick={beginEdit}
        >
          {projectName}
        </button>
      )}

      <button
        type="button"
        className="arq-shell-button"
        disabled={!canUndo}
        title={undoTooltip({ canUndo, canRedo }, lastUndoActionLabel) ?? undefined}
        aria-label="Undo"
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        className="arq-shell-button"
        disabled={!canRedo}
        title={redoTooltip({ canUndo, canRedo }, lastRedoActionLabel) ?? undefined}
        aria-label="Redo"
        onClick={onRedo}
      >
        Redo
      </button>

      {/* Section 12 rule: "save and sync must be separate concepts" - two independent, always-visible indicators, never merged. */}
      <span aria-live="polite">{describeSaveState(saveState)}</span>
      <span aria-live="polite">{describeSyncState(syncState)}</span>

      <span aria-label="Active view">{activeViewName}</span>

      <div style={{ flex: 1 }} />

      <button type="button" className="arq-shell-button" onClick={onShare}>
        Share
      </button>
      <button
        type="button"
        className="arq-shell-button"
        aria-label="Search commands"
        onClick={onOpenCommandPalette}
      >
        Search
      </button>
      <button
        type="button"
        className="arq-shell-button"
        aria-label="Account menu"
        onClick={onOpenAccountMenu}
      >
        Account
      </button>
    </header>
  );
}
