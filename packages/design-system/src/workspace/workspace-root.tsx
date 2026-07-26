import type { ReactNode } from 'react';
import {
  occupiesLayoutWidth,
  panelDockingPolicy,
  resolveLayoutSlots,
  resolveWorkspacePlatform,
  viewSwitcherHeightPx,
  type PanelLayoutState,
  type ViewportProbe,
  type WorkspaceMode,
  type WorkspacePlatform,
  type WorkspaceProjectContext,
} from '@arq/workspace';
import { ModeRail, MODE_RAIL_WIDTH_PX } from './mode-rail';
import { TOOL_RAIL_WIDTH_PX } from '../shell/tool-rail';

/**
 * The width the two vertical rails actually occupy in this shell, for the
 * canvas-floor calculation in @arq/workspace. Pass this as
 * `reconcileDockedPanels({ railsWidthPx })` - the registry's own
 * `modeRail + toolRail` describes an icon-only rail pair this repository does
 * not render, and using it would leave the floor optimistic by ~150px.
 *
 * Zero at the phone band, where `WorkspaceRoot` renders no rails at all.
 */
export const WORKSPACE_RAILS_WIDTH_PX = MODE_RAIL_WIDTH_PX + TOOL_RAIL_WIDTH_PX;

export function workspaceRailsWidthPx(platform: WorkspacePlatform): number {
  return panelDockingPolicy(platform) === 'drawers-only' ? 0 : WORKSPACE_RAILS_WIDTH_PX;
}

export interface WorkspaceRootProps {
  readonly project: WorkspaceProjectContext;
  readonly activeMode: WorkspaceMode;
  readonly onSelectMode: (mode: WorkspaceMode) => void;
  readonly probe: ViewportProbe;
  readonly panels: PanelLayoutState;

  /**
   * Slots, not children: doc 36 fixes the *order* of the shell (project bar,
   * tab strip, rails, browser, viewport, inspector, context bar, status bar),
   * and a slot API is what stops a host reordering it by accident. The
   * components that fill them are the repository's existing TopBar, ToolRail,
   * ModelPanel, InspectorShell, ContextBar and StatusBar - Package 3.0's
   * execution prompt §0 is explicit that it "extends/converges those contracts;
   * it is not permission to delete them and rebuild from screenshots".
   */
  readonly projectBar: ReactNode;
  readonly tabStrip: ReactNode;
  readonly toolRail: ReactNode;
  readonly projectBrowser: ReactNode;
  readonly viewport: ReactNode;
  readonly inspector: ReactNode;
  readonly contextBar: ReactNode;
  readonly statusBar: ReactNode;
}

function OverlayPanel(props: {
  readonly side: 'left' | 'right';
  readonly widthPx: number;
  readonly children: ReactNode;
}): JSX.Element {
  const { side, widthPx, children } = props;
  return (
    <div
      className={`arq-workspace__overlay arq-workspace__overlay--${side}`}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: widthPx,
        zIndex: 2,
        borderLeft: side === 'right' ? '1px solid var(--arq-ui-line-default)' : undefined,
        borderRight: side === 'left' ? '1px solid var(--arq-ui-line-default)' : undefined,
        background: 'var(--arq-ui-paper)',
        overflow: 'auto',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Package 3.0 doc 33 ("Project Workspace Operating Model") and doc 36 ("Editor
 * Shell Master Layout"): the persistent shell an open project lives inside.
 *
 * ```text
 * GlobalProjectBar
 * ProjectTabStrip
 * ───────────────────────────────────────
 * ModeRail │ ToolRail │ Browser │ Viewport │ Inspector
 * ───────────────────────────────────────
 * ContextActionBar
 * WorkspaceStatusBar
 * ```
 *
 * Two behaviours are the reason this is a component rather than a CSS file:
 *
 * 1. **Docked versus floating panels.** A panel whose state is `'overlay'` is
 *    absolutely positioned over the canvas instead of taking width from it -
 *    doc 36's "Before that happens, turn the Inspector into an overlay." The
 *    decision itself belongs to `reconcileDockedPanels` in @arq/workspace; this
 *    component only renders it.
 * 2. **Touch is a different composition, not a narrower one.** Doc 46: "Never
 *    shrink desktop three-column UI onto a phone", and iPad portrait gets "No
 *    left+right desktop columns." On every band whose docking policy is
 *    `'drawers-only'` - phone *and* both tablet bands - the rails and docked
 *    columns are not rendered at all. The canvas takes the full width and the
 *    browser, inspector and tools are reached through drawers and sheets the
 *    host presents.
 *
 * The context action bar's slot is always reserved on desktop even when empty.
 * Doc 36: "its insertion must not shift the canvas by surprise during pointer
 * operations" - a bar that appears mid-drag moves the canvas under the user's
 * cursor and ruins the very operation that summoned it.
 */
export function WorkspaceRoot(props: WorkspaceRootProps): JSX.Element {
  const {
    project,
    activeMode,
    onSelectMode,
    probe,
    panels,
    projectBar,
    tabStrip,
    toolRail,
    projectBrowser,
    viewport,
    inspector,
    contextBar,
    statusBar,
  } = props;

  const platform: WorkspacePlatform = resolveWorkspacePlatform(probe);
  const slots = resolveLayoutSlots(probe);
  const canvasFirst = panelDockingPolicy(platform) === 'drawers-only';
  const phone = platform === 'phone';

  const browserDocked = !canvasFirst && occupiesLayoutWidth(panels, 'project-browser');
  const inspectorDocked = !canvasFirst && occupiesLayoutWidth(panels, 'inspector');
  // A drawer still renders when the user has opened it - it simply floats over
  // the canvas rather than taking width from it.
  const browserFloating = panels['project-browser'].open && !browserDocked;
  const inspectorFloating = panels.inspector.open && !inspectorDocked;

  return (
    <div
      className={`arq-workspace arq-workspace--${platform}`}
      data-workspace-mode={activeMode}
      data-workspace-open-state={project.openState}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 0 }}
    >
      <div style={{ minHeight: slots.topBar, flex: '0 0 auto' }}>{projectBar}</div>
      <div style={{ minHeight: viewSwitcherHeightPx(slots), flex: '0 0 auto' }}>{tabStrip}</div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
        {!canvasFirst && (
          <ModeRail project={project} activeMode={activeMode} onSelectMode={onSelectMode} />
        )}
        {!canvasFirst && toolRail}

        {browserDocked && (
          <div
            className="arq-workspace__docked arq-workspace__docked--left"
            style={{ width: panels['project-browser'].widthPx, flex: '0 0 auto', minWidth: 0 }}
          >
            {projectBrowser}
          </div>
        )}

        <main
          className="arq-workspace__viewport"
          aria-label="Canvas"
          style={{ flex: 1, minWidth: 0, position: 'relative' }}
        >
          {viewport}
        </main>

        {inspectorDocked && (
          <div
            className="arq-workspace__docked arq-workspace__docked--right"
            style={{ width: panels.inspector.widthPx, flex: '0 0 auto', minWidth: 0 }}
          >
            {inspector}
          </div>
        )}

        {browserFloating && (
          <OverlayPanel side="left" widthPx={panels['project-browser'].widthPx}>
            {projectBrowser}
          </OverlayPanel>
        )}
        {inspectorFloating && (
          <OverlayPanel side="right" widthPx={panels.inspector.widthPx}>
            {inspector}
          </OverlayPanel>
        )}
      </div>

      {!phone && (
        <div
          className="arq-workspace__context-bar"
          style={{ minHeight: slots.contextBar ?? 0, flex: '0 0 auto' }}
        >
          {contextBar}
        </div>
      )}
      <div style={{ minHeight: slots.statusBar ?? slots.statusMinimal ?? 0, flex: '0 0 auto' }}>
        {statusBar}
      </div>
    </div>
  );
}
