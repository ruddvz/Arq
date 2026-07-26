import {
  WORKSPACE_MODES,
  modeUnavailableReason,
  type WorkspaceMode,
  type WorkspaceProjectContext,
} from '@arq/workspace';

export interface ModeRailProps {
  readonly project: WorkspaceProjectContext;
  readonly activeMode: WorkspaceMode;
  readonly onSelectMode: (mode: WorkspaceMode) => void;
}

/**
 * The rendered width of this rail, in CSS px.
 *
 * Doc 36 allows 48px for an icon mode rail. This rail is wider because it uses
 * text: `design/icons/svg/` ships no mode glyphs (only `inspect.svg`), and
 * blueprint section 174's warning that "generic icon libraries are
 * insufficient" applies just as much to five invented mode pictograms as it did
 * to the tool-rail categories. 112px fits "Document" at the shell's type size
 * without truncation.
 *
 * Exported for the same reason as `TOOL_RAIL_WIDTH_PX`: the canvas-floor
 * calculation needs the width that is actually on screen.
 */
export const MODE_RAIL_WIDTH_PX = 112;

const MODE_LABEL: Readonly<Record<WorkspaceMode, string>> = {
  design: 'Design',
  document: 'Document',
  inspect: 'Inspect',
  review: 'Review',
  present: 'Present',
};

/**
 * Package 3.0 doc 36 ("Editor Shell Master Layout") > "The two vertical rails
 * sit before the browser", and doc 34 > "Modes".
 *
 * The mode rail is deliberately a *separate* component from ToolRail even
 * though doc 36 allows them to "merge visually": they answer different
 * questions ("what am I doing?" versus "what am I doing it with?"), and doc 36
 * requires they stay "semantically separate". Two components with two
 * `aria-label`s is what makes that true for a screen-reader user, not just for
 * a sighted one reading the gap between them.
 *
 * States: the active mode carries `aria-pressed="true"`, which
 * shell-controls.css renders as the blueprint's black container with white
 * glyph (section 18) - an unmistakable state that is also announced, never
 * colour alone. Doc 36's "Mode icons remain visually distinct from tool
 * categories through grouping/spacing, not a second colour system" is why this
 * rail introduces no colours of its own.
 *
 * Unavailable modes stay visible and disabled with their reason in the
 * accessible name rather than being removed - the execution prompt's §3 rule
 * that every control must be able to explain itself. A read-only collaborator
 * should be able to see that Design exists and learn why they cannot enter it.
 */
export function ModeRail(props: ModeRailProps): JSX.Element {
  const { project, activeMode, onSelectMode } = props;

  return (
    <nav
      className="arq-mode-rail arq-shell-panel"
      aria-label="Workspace modes"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--arq-space-micro)',
        padding: 'var(--arq-space-micro)',
        borderRight: '1px solid var(--arq-ui-line-subtle)',
        width: MODE_RAIL_WIDTH_PX,
        flex: '0 0 auto',
      }}
    >
      {WORKSPACE_MODES.map((mode) => {
        const reason = modeUnavailableReason(project, mode);
        const label = MODE_LABEL[mode];
        return (
          <button
            key={mode}
            type="button"
            className="arq-shell-button arq-mode-rail__button"
            aria-pressed={mode === activeMode}
            disabled={reason !== null}
            aria-label={reason === null ? label : `${label}. Unavailable: ${reason}`}
            title={reason ?? undefined}
            onClick={() => onSelectMode(mode)}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
