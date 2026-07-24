import { useState, type ReactNode } from 'react';
import { toggleFullScreenCanvas } from './ipad-shell-state';
import { TopBar, type TopBarProps } from './top-bar';
import { ToolRail, type ToolRailProps } from './tool-rail';
import { InspectorShell, type InspectorShellProps } from './inspector-shell';
import { StatusBar, type StatusBarProps } from './status-bar';
import { ContextBar, type ContextBarProps } from './context-bar';

export interface IPadLandscapeShellProps {
  readonly topBar: TopBarProps;
  readonly toolRail: ToolRailProps;
  readonly inspector: InspectorShellProps;
  readonly statusBar: StatusBarProps;
  readonly contextBar: ContextBarProps;
  readonly canvasSlot: ReactNode;
}

/**
 * ARQ-030: prototype iPad landscape shell. Blueprint section 13 >
 * "Landscape": "compact top bar; floating left tool palette; right
 * inspector drawer; bottom numeric and contextual strip; full-screen
 * canvas toggle."
 *
 * A composition of the already-built shell components, not new controls:
 * the top bar/tool rail/inspector/status bar/context bar are reused
 * as-is (no separate "compact" visual variant exists yet - section 13 does
 * not specify what compact changes beyond size, and no real iPad device is
 * available in this sandbox to design that against, so this prototype
 * keeps identical components at the same shell layout, matching the
 * portrait/iPad-hardware honesty already documented elsewhere in this
 * repository, e.g. the RoomPlan/LiDAR adapters). The tool rail is
 * positioned as a floating palette (`position: absolute`) rather than a
 * docked column, and the inspector is a drawer that only occupies space
 * while open (`inspectorOpen`), per section 13's own wording.
 *
 * States: the full-screen toggle is a real two-state toggle
 * (`toggleFullScreenCanvas`) - hides every chrome element except the
 * canvas slot. Keyboard/touch: unchanged from the underlying components,
 * which already meet the 44px iPad touch-target minimum.
 */
export function IPadLandscapeShell(props: IPadLandscapeShellProps): JSX.Element {
  const { topBar, toolRail, inspector, statusBar, contextBar, canvasSlot } = props;
  const [fullScreenCanvas, setFullScreenCanvas] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!fullScreenCanvas && <TopBar {...topBar} />}
      <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
        {!fullScreenCanvas && (
          <div
            style={{
              position: 'absolute',
              top: 'var(--arq-space-panel)',
              left: 'var(--arq-space-panel)',
              zIndex: 1,
            }}
          >
            <ToolRail {...toolRail} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>{canvasSlot}</div>
        {!fullScreenCanvas && inspectorOpen && <InspectorShell {...inspector} />}
        <button
          type="button"
          className="arq-shell-button"
          aria-pressed={fullScreenCanvas}
          aria-label="Toggle full-screen canvas"
          style={{
            position: 'absolute',
            top: 'var(--arq-space-panel)',
            right: 'var(--arq-space-panel)',
            zIndex: 1,
          }}
          onClick={() => setFullScreenCanvas(toggleFullScreenCanvas)}
        >
          {fullScreenCanvas ? 'Exit full screen' : 'Full screen'}
        </button>
        {!fullScreenCanvas && (
          <button
            type="button"
            className="arq-shell-button"
            aria-pressed={inspectorOpen}
            aria-label="Toggle inspector drawer"
            style={{
              position: 'absolute',
              top: 'var(--arq-space-panel)',
              right: 'calc(var(--arq-space-panel) + 140px)',
              zIndex: 1,
            }}
            onClick={() => setInspectorOpen((open) => !open)}
          >
            Inspector
          </button>
        )}
      </div>
      {!fullScreenCanvas && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ContextBar {...contextBar} />
          <StatusBar {...statusBar} />
        </div>
      )}
    </div>
  );
}
