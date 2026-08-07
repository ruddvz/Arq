import {
  formatActiveSnap,
  formatModelHealth,
  formatPerformanceWarning,
  type ModelHealthSummary,
} from './status-bar-state';

export interface StatusBarProps {
  readonly activeSnapLabel: string | null;
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
    activeSnapLabel,
    modelHealth,
    activeToolLabel = null,
    localJournalStateLabel,
    supportModeEnabled,
    variant = 'full',
  } = props;

  const full = variant === 'full';

  const performanceWarning = formatPerformanceWarning(supportModeEnabled);
  const issuesToReport = modelHealth.errorCount > 0 || modelHealth.warningCount > 0;

  return (
    <footer
      className="arq-status-bar arq-shell-panel arq-material arq-material--optical"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--arq-space-section)',
        // Two groups, pushed to the two ends of the strip.
        justifyContent: 'space-between',
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
       * Two groups, at the two ends of the strip, and only the fields that are
       * worth permanent space.
       *
       * It carried nine, then five: coordinates, snap, selection count, model
       * health, the working copy, sync. The reference carries two - what the
       * pointer will snap to, and where the work is being kept - and reading
       * the two side by side, the reference is right about the ones it drops.
       *
       * Cursor coordinates change on every pointer move and are read by almost
       * nobody at almost any moment; selection is stated by the Inspector,
       * which is the surface a reader is already looking at when they care.
       * Neither carries a guarantee, and the strip's whole reason to exist is
       * the two fields that do.
       *
       * Model health is the exception, and it is now conditional: a permanent
       * "No issues" is a phrase the eye stops seeing, so when it changes to "3
       * errors" nobody notices. Shown only when there is something to say, it
       * is the one thing on the strip that ever moves, and it is announced.
       */}
      <span className="arq-status-bar__group">
        {!full && activeToolLabel !== null && (
          /*
           * The tool leads on a phone, because it is the field that changes
           * what the next tap does. aria-live because the change is usually
           * made from a sheet that has closed by the time it takes effect, so
           * there is nothing left on screen for a screen reader to announce.
           */
          <span role="status" aria-live="polite">
            Tool: {activeToolLabel}
          </span>
        )}
        {full && (
          /*
           * Labelled only when there is something to label. `formatActiveSnap`
           * already words the empty case as "No snap", so prefixing it
           * unconditionally produced "Snap: No snap" - a phrase that reads as a
           * bug even though both halves are correct.
           */
          <span>
            {activeSnapLabel === null ? formatActiveSnap(null) : `Snap: ${activeSnapLabel}`}
          </span>
        )}
        {issuesToReport && (
          <span role="status" aria-live="polite">
            {formatModelHealth(modelHealth)}
          </span>
        )}
        {performanceWarning !== null && <span role="alert">{performanceWarning}</span>}
      </span>

      {/*
       * Where the work is kept - the one guarantee no other bar makes.
       *
       * Sync used to be printed beside it, and that was the rule this file
       * states being broken by this file. Doc 09: save and sync are not
       * repeated across bars, which is why the minimal strip drops them and why
       * the announcements were removed from here. The full strip kept showing
       * sync anyway, so at desktop "Sync not configured" was on screen twice at
       * once - top bar and status strip - and the save condition was stated
       * twice in two different wordings. Dropping the announcement and keeping
       * the text is not applying the rule; it just makes the repetition silent
       * to a screen reader and visible to everyone else.
       */}
      {full && (
        <span className="arq-status-bar__group">
          <span>{localJournalStateLabel}</span>
        </span>
      )}
    </footer>
  );
}
