import { useState, type ReactNode } from 'react';
import { toggleBottomSheetExpanded } from './ipad-shell-state';
import { ToolRail, type ToolRailProps } from './tool-rail';
import { InspectorShell, type InspectorShellProps } from './inspector-shell';

export interface IPadPortraitShellProps {
  readonly toolRail: ToolRailProps;
  readonly inspector: InspectorShellProps;
  readonly canvasSlot: ReactNode;
  /** Rendered above the software keyboard when present (section 13: "numeric entry remains visible above the software keyboard") - a caller-supplied slot, since no numeric-entry component lives in this package (that is @arq/editor-shell's metric/imperial-numeric-input.ts, a domain-editing concern this UI-shell package stays decoupled from). */
  readonly numericEntrySlot?: ReactNode;
}

/**
 * ARQ-031: prototype iPad portrait shell. Blueprint section 13 >
 * "Portrait": "canvas first; inspector as a resizable bottom sheet; tool
 * palette collapses to categories; numeric entry remains visible above the
 * software keyboard; no full desktop panel arrangement squeezed into
 * portrait."
 *
 * "Canvas first": the canvas slot always fills remaining space and is
 * rendered before any other chrome in layout order. "Tool palette
 * collapses to categories": the tool rail is reused unchanged - it already
 * shows only category buttons until one is expanded (tool-rail-state.ts's
 * "maximum one expanded category" rule), which is exactly this behaviour,
 * so no separate portrait-only tool rail exists. "No full desktop panel
 * arrangement": deliberately does not render a model panel or a docked
 * inspector column side-by-side with the canvas - only the bottom sheet
 * and a slim top tool strip, matching the constraint literally by
 * omission, not by shrinking the desktop layout to fit.
 *
 * The bottom sheet's resize is a two-state toggle
 * (`toggleBottomSheetExpanded`) - see ipad-shell-state.ts's doc comment for
 * why a real freeform drag gesture is out of scope for this prototype.
 */
export function IPadPortraitShell(props: IPadPortraitShellProps): JSX.Element {
  const { toolRail, inspector, canvasSlot, numericEntrySlot } = props;
  const [sheetExpanded, setSheetExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--arq-ui-line-subtle)' }}>
        <ToolRail {...toolRail} />
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{canvasSlot}</div>
      {numericEntrySlot}
      <button
        type="button"
        className="arq-shell-button"
        aria-pressed={sheetExpanded}
        aria-label="Toggle inspector sheet"
        onClick={() => setSheetExpanded(toggleBottomSheetExpanded)}
      >
        Inspector
      </button>
      {sheetExpanded && (
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          <InspectorShell {...inspector} />
        </div>
      )}
    </div>
  );
}
