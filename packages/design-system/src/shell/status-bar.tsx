import {
  formatActiveSnap,
  formatCoordinates,
  formatModelHealth,
  formatPerformanceWarning,
  formatSelectionCount,
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
  readonly modelHealth: ModelHealthSummary;
  /**
   * The tool a tap on the canvas will use, or null when there is none.
   *
   * Only the phone strip shows it, because only the phone has nowhere else to:
   * the desktop and tablet keep the tool rail on screen with the active tool
   * pressed, and the context bar names it again. The phone had it as a separate
   * chip above the dock, which put three stacked strips - status, chip, dock -
   * under a 932px-tall canvas to state two facts.
   */
  readonly activeToolLabel?: string | null;
  readonly localJournalStateLabel: string;
  readonly syncState: SyncState;
  readonly supportModeEnabled: boolean;
  /**
   * `'minimal'` is the touch strip the layout registry already sizes
   * (`statusMinimal: 28`), carrying only what a device without a cursor can act
   * on.
   *
   * The full strip is a row of authoring readouts, and on a touch band most of
   * them cannot be true. Cursor coordinates and active snap describe a pointer
   * that is not there, and save and sync are already stated above - on the
   * project bar on a phone, on the top bar on a tablet - which doc 09 says
   * should not be repeated across bars. On a 430px phone the full set wrapped
   * to two rows and the second was clipped by the dock; at 1024px it wrapped
   * and pushed sync state off the bottom of the window.
   */
  readonly variant?: 'full' | 'minimal';
}

/**
 * ARQ-027: build status bar. Blueprint section 12 > "Bottom status bar" -
 * see status-bar-state.ts for rules and the "support mode" non-goal.
 *
 * A read-only strip, so its only interactive states are per-item keyboard
 * focus (each item is not itself focusable by design - status text is not an
 * interactive control, so making it one would add fake tab stops). No
 * hover/active/disabled variants apply here since nothing here is a button -
 * the "error" state is the model health summary switching to naming errors,
 * still plain text (section 126: "status not colour-only").
 *
 * **The strip as a whole is not a live region, and must not become one
 * again.** It previously carried `role="status" aria-live="polite"` on the
 * `<footer>`, which meant every child announced itself on change - including
 * the cursor world position, which changes on every pointer move. A polite
 * region queues rather than interrupts, so a screen reader would fall
 * arbitrarily far behind reading coordinates aloud and never reach anything
 * else: the effect of announcing everything is that nothing is heard. It also
 * announced sync state a second time, because top-bar.tsx already announces
 * that field politely.
 *
 * Section 127's canvas-accessibility requirement is that the readout be
 * available, not that it be spoken continuously; the coordinates, snap, scale
 * and selection readouts stay plain text a screen-reader user navigates to
 * when they want them. Only the model health summary is announced, because it
 * is the one field here that changes meaningfully, that the user did not just
 * cause, and that no other surface already announces.
 */
export function StatusBar(props: StatusBarProps): JSX.Element {
  const {
    unitLabel,
    cursorWorldPosition,
    activeSnapLabel,
    selectionCount,
    modelHealth,
    activeToolLabel = null,
    localJournalStateLabel,
    syncState,
    supportModeEnabled,
    variant = 'full',
  } = props;

  const full = variant === 'full';

  const performanceWarning = formatPerformanceWarning(supportModeEnabled);

  return (
    <footer
      className="arq-status-bar arq-shell-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--arq-space-section)',
        padding: 'var(--arq-space-micro) var(--arq-space-panel)',
        borderTop: '1px solid var(--arq-ui-line-subtle)',
        color: 'var(--arq-ui-text-secondary)',
        fontSize: '0.875em',
        /*
         * Wraps rather than overflows at narrow widths, for the same reason as
         * top-bar.tsx: at 393px these fields ran to 494px and pushed a
         * horizontal scrollbar onto the document.
         *
         * Wrapping used to be the whole answer, on the grounds that the phone
         * had nowhere else to put save and sync. It does now - the phone
         * project bar states both - so the phone uses `variant="minimal"` and
         * the wrap is left as the safety net it should always have been,
         * rather than the design.
         */
        flexWrap: 'wrap',
        rowGap: 'var(--arq-space-micro)',
      }}
    >
      {/*
       * The strip carried nine fields and now carries five, and the four that
       * went were duplicates rather than sacrifices.
       *
       * The units label stood alone beside a coordinate readout that already
       * carries its units, so it said "mm" twice. The level name and the view
       * scale are both on the view's own title card over the drawing, which is
       * where a reader looks for them - reporting them again at the far edge of
       * the window is not redundancy that helps.
       *
       * Nothing about save, sync or the working copy was touched. Those are the
       * fields that stop the product implying a save it has not made, and they
       * are the reason this strip exists at all.
       */}
      {/*
       * The tool leads the strip on a phone, because it is the field that
       * changes what the next tap does. aria-live because the change is usually
       * made from a sheet that has closed by the time it takes effect, so there
       * is nothing left on screen for a screen reader to have announced.
       */}
      {!full && activeToolLabel !== null && (
        <span role="status" aria-live="polite">
          Tool: {activeToolLabel}
        </span>
      )}
      {full && <span>{formatCoordinates(cursorWorldPosition, unitLabel)}</span>}
      {full && <span>{formatActiveSnap(activeSnapLabel)}</span>}
      <span>{formatSelectionCount(selectionCount)}</span>
      {/* The one field announced: validation results change without the user
          having just typed them, and nothing else reports them aloud. */}
      <span role="status" aria-live="polite">
        {formatModelHealth(modelHealth)}
      </span>
      {/* Save and sync are announced by top-bar.tsx. Repeating the
          announcement here made a screen reader say each change twice. On a
          phone they are on the project bar instead, so the strip omits them
          rather than showing the same fact in two places. */}
      {full && <span>{localJournalStateLabel}</span>}
      {full && <span>{describeSyncState(syncState)}</span>}
      {performanceWarning !== null && <span role="alert">{performanceWarning}</span>}
    </footer>
  );
}
