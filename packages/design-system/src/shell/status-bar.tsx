import {
  formatActiveSnap,
  formatCoordinates,
  formatModelHealth,
  formatPerformanceWarning,
  formatSelectionCount,
  formatViewScale,
  type ModelHealthSummary,
  type StatusBarCoordinates,
} from './status-bar-state';
import type { SyncState } from './top-bar-state';
import { describeSyncState } from './top-bar-state';

export interface StatusBarProps {
  readonly unitLabel: string;
  readonly cursorWorldPosition: StatusBarCoordinates | null;
  readonly activeSnapLabel: string | null;
  readonly selectionCount: number;
  readonly currentLevelName: string;
  readonly pixelsPerUnit: number;
  readonly modelHealth: ModelHealthSummary;
  readonly localJournalStateLabel: string;
  readonly syncState: SyncState;
  readonly supportModeEnabled: boolean;
}

/**
 * ARQ-027: build status bar. Blueprint section 12 > "Bottom status bar" -
 * see status-bar-state.ts for rules and the "support mode" non-goal.
 *
 * A read-only strip, so its only interactive states are per-item keyboard
 * focus (each `<output>` is not itself focusable by design - status text is
 * not an interactive control; a screen reader still gets it live via
 * `aria-live`, satisfying section 127's canvas-accessibility requirement
 * without adding fake tab stops). No hover/active/disabled variants apply
 * here since nothing here is a button - the "error" state is the model
 * health summary switching to naming errors, still plain text (section 126:
 * "status not colour-only").
 */
export function StatusBar(props: StatusBarProps): JSX.Element {
  const {
    unitLabel,
    cursorWorldPosition,
    activeSnapLabel,
    selectionCount,
    currentLevelName,
    pixelsPerUnit,
    modelHealth,
    localJournalStateLabel,
    syncState,
    supportModeEnabled,
  } = props;

  const performanceWarning = formatPerformanceWarning(supportModeEnabled);

  return (
    <footer
      className="arq-status-bar arq-shell-panel"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--arq-space-section)',
        padding: 'var(--arq-space-micro) var(--arq-space-panel)',
        borderTop: '1px solid var(--arq-ui-line-subtle)',
        color: 'var(--arq-ui-text-secondary)',
        fontSize: '0.875em',
      }}
    >
      <span>{unitLabel}</span>
      <span>{formatCoordinates(cursorWorldPosition, unitLabel)}</span>
      <span>{formatActiveSnap(activeSnapLabel)}</span>
      <span>{formatSelectionCount(selectionCount)}</span>
      <span>{currentLevelName}</span>
      <span>{formatViewScale(pixelsPerUnit)}</span>
      <span>{formatModelHealth(modelHealth)}</span>
      <span>{localJournalStateLabel}</span>
      <span>{describeSyncState(syncState)}</span>
      {performanceWarning !== null && <span role="alert">{performanceWarning}</span>}
    </footer>
  );
}
