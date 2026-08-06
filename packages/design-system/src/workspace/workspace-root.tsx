import type { ReactNode } from 'react';
import {
  CLOSED_SHEET_STATE,
  occupiesLayoutWidth,
  panelDockingPolicy,
  phoneBottomOwner,
  resolveLayoutSlots,
  resolveWorkspacePlatform,
  viewSwitcherHeightPx,
  type PanelLayoutState,
  type SheetDetent,
  type SheetId,
  type SheetState,
  type ViewportProbe,
  type WorkspaceMode,
  type WorkspacePlatform,
  type WorkspaceProjectContext,
} from '@arq/workspace';
import { ModeRail, MODE_RAIL_WIDTH_PX } from './mode-rail';
import { TOOL_RAIL_DOCK_WIDTH_PX, TOOL_RAIL_WIDTH_PX } from '../shell/tool-rail';
import { WorkspaceSheet } from './workspace-sheet';
import { PhoneDock } from './phone-dock';
import { TabletDrawerBar } from './tablet-drawer-bar';
import { PanelResizeHandle } from './panel-resize-handle';

/**
 * The width the two vertical rails actually occupy in this shell, for the
 * canvas-floor calculation in @arq/workspace. Pass this as
 * `reconcileDockedPanels({ railsWidthPx })` - the registry's own
 * `modeRail + toolRail` describes an icon-only rail pair this repository does
 * not render, and using it would leave the floor optimistic by ~150px.
 *
 * Zero on the touch bands, where `WorkspaceRoot` renders no rails at all.
 */
export const WORKSPACE_RAILS_WIDTH_PX = MODE_RAIL_WIDTH_PX + TOOL_RAIL_WIDTH_PX;

/** The same pair once the tool rail is an icon dock rather than a labelled column. */
export const WORKSPACE_RAILS_DOCK_WIDTH_PX = MODE_RAIL_WIDTH_PX + TOOL_RAIL_DOCK_WIDTH_PX;

/**
 * `toolRailIsDock` has to be told, not guessed: the rail decides its own width
 * from whether the host gave it a glyph for every category, and the canvas
 * floor and the floating panels' inset both depend on the answer. Getting it
 * wrong does not throw - it leaves the navigator hanging in the middle of the
 * drawing, which is exactly what happened when the dock landed and this still
 * reported 312px.
 */
export function workspaceRailsWidthPx(platform: WorkspacePlatform, toolRailIsDock = false): number {
  if (panelDockingPolicy(platform) === 'drawers-only') {
    return 0;
  }
  return toolRailIsDock ? WORKSPACE_RAILS_DOCK_WIDTH_PX : WORKSPACE_RAILS_WIDTH_PX;
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
  /**
   * Doc 47's phone top bar: "Back/Projects, project name, active view, status
   * chip, More." Rendered instead of `projectBar` at the phone band. The
   * desktop bar is not a narrow phone bar - measured at 393px it wrapped to
   * three rows and 173px against the registry's 48px - so a host targeting
   * phones should pass this. Falls back to `projectBar` when absent.
   */
  readonly phoneProjectBar?: ReactNode;
  readonly tabStrip: ReactNode;
  /**
   * Doc 34: "on phone, tabs become a compact current-view control plus a
   * full-height View Switcher." Rendered instead of `tabStrip` at the phone
   * band. Falls back to `tabStrip` when a host does not supply one, so nothing
   * disappears - but the strip is the wrong composition there, so hosts that
   * target phones should pass this.
   */
  readonly compactViewControl?: ReactNode;
  readonly toolRail: ReactNode;
  readonly projectBrowser: ReactNode;
  readonly viewport: ReactNode;
  readonly inspector: ReactNode;
  readonly contextBar: ReactNode;
  readonly statusBar: ReactNode;

  /**
   * Touch presentation. On a `'drawers-only'` band the browser and inspector
   * are closed by `reconcileDockedPanels`, so without these the user has no way
   * to summon them back - a panel that cannot be opened does not exist.
   *
   * Defaults to a closed sheet with no handlers, which renders the shell
   * exactly as it did before this existed. A host that only targets desktop
   * need not pass any of it.
   */
  readonly sheet?: SheetState;
  readonly onToggleSheet?: (sheet: SheetId) => void;
  readonly onCloseSheet?: () => void;
  readonly onExpandSheet?: () => void;
  readonly onCollapseSheet?: () => void;
  /** Doc 47's drag gesture, layered on top of the grabber button. */
  readonly onSheetDragToDetent?: (detent: SheetDetent) => void;
  /** Doc 47: the dock's Select entry activates the tool rather than opening a sheet. */
  readonly onSelectPointerTool?: () => void;
  readonly activeToolLabel?: string | null;
  readonly toolsSheet?: ReactNode;
  readonly viewSwitcherSheet?: ReactNode;
  readonly reviewSheet?: ReactNode;
  readonly reviewDisabledReason?: string;
  /**
   * Doc 36: the docked panels are resizable within the registry's bounds.
   * Omitted means no handle is rendered - a handle that reports a width nobody
   * stores is worse than none.
   */
  readonly onResizePanel?: (panel: 'project-browser' | 'inspector', widthPx: number) => void;
  /**
   * True when the host supplied a glyph for every tool category, so the rail
   * rendered as a 48px dock. Only affects where floating panels start.
   */
  readonly toolRailIsDock?: boolean;
}

function OverlayPanel(props: {
  readonly side: 'left' | 'right';
  readonly widthPx: number;
  readonly label?: string;
  /** Present only for the tablet drawers, which are dismissable dialogs. */
  readonly onDismiss?: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  const { side, widthPx, label, onDismiss, children } = props;
  return (
    <div
      /*
       * The inspector is a large presentation over varied content, which is
       * the case the strong variant exists for. The project browser on the
       * left is a list and reads cleanly at regular strength.
       */
      className={`arq-workspace__overlay arq-workspace__overlay--${side} arq-material${
        side === 'right' ? ' arq-material--strong' : ''
      }`}
      role={label === undefined ? undefined : 'dialog'}
      aria-label={label}
      /*
       * A drawer that announces itself as a dialog must be dismissable by
       * keyboard. It is deliberately not `aria-modal`: the canvas beside it
       * stays visible and usable on a landscape tablet, which is the whole
       * point of a drawer rather than a sheet.
       */
      onKeyDown={
        onDismiss === undefined
          ? undefined
          : (event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                onDismiss();
              }
            }
      }
      style={{
        /*
         * Width only. Placement lives in workspace-shell.css, because an inline
         * `left: 0` beats any rule a stylesheet can write - which is exactly
         * what happened when the floating composition tried to inset this panel
         * past the rails and silently lost to the inline value.
         *
         * Surface and border belong to `arq-material` (ADR-0031) for the same
         * reason: an inline background would turn the material off one surface
         * at a time without removing anything.
         */
        width: widthPx,
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

const SHEET_TITLE: Readonly<Record<SheetId, string>> = {
  tools: 'Tools',
  'view-switcher': 'Views',
  'project-browser': 'Project browser',
  inspector: 'Inspector',
  review: 'Review',
};

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
 * Three behaviours are the reason this is a component rather than a CSS file:
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
 *    columns are not rendered at all.
 * 3. **Each touch band gets the presentation its own doc specifies.** Landscape
 *    tablet uses side drawers ("Browser drawer, Inspector drawer", doc 46);
 *    portrait tablet and phone use bottom sheets ("Browser and inspector are
 *    sheets"). One `SheetState` drives both - the band picks the presentation,
 *    so there is a single source of truth for what is open.
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
    phoneProjectBar,
    tabStrip,
    compactViewControl,
    toolRail,
    projectBrowser,
    viewport,
    inspector,
    contextBar,
    statusBar,
    sheet = CLOSED_SHEET_STATE,
    onToggleSheet,
    onCloseSheet,
    onExpandSheet,
    onCollapseSheet,
    onSheetDragToDetent,
    onSelectPointerTool,
    activeToolLabel = null,
    toolsSheet,
    viewSwitcherSheet,
    reviewSheet,
    reviewDisabledReason,
    onResizePanel,
    toolRailIsDock = false,
  } = props;

  const platform: WorkspacePlatform = resolveWorkspacePlatform(probe);
  const slots = resolveLayoutSlots(probe);
  const canvasFirst = panelDockingPolicy(platform) === 'drawers-only';
  const phone = platform === 'phone';
  // Doc 46: landscape tablet keeps side drawers; portrait tablet and phone use
  // bottom sheets. Sheets are also what a phone's software keyboard can push
  // against without stranding a numeric field off-screen.
  const usesBottomSheets = phone || platform === 'tablet-portrait';
  const touchControlsAvailable = canvasFirst && onToggleSheet !== undefined;

  const browserDocked = !canvasFirst && occupiesLayoutWidth(panels, 'project-browser');
  const inspectorDocked = !canvasFirst && occupiesLayoutWidth(panels, 'inspector');
  // On the docking bands a panel the floor pushed out still renders - it simply
  // floats over the canvas rather than taking width from it.
  const browserFloating = !canvasFirst && panels['project-browser'].open && !browserDocked;
  const inspectorFloating = !canvasFirst && panels.inspector.open && !inspectorDocked;

  function sheetBody(id: SheetId): ReactNode {
    switch (id) {
      case 'project-browser':
        return projectBrowser;
      case 'inspector':
        return inspector;
      case 'tools':
        return toolsSheet ?? toolRail;
      case 'view-switcher':
        return viewSwitcherSheet ?? tabStrip;
      case 'review':
        return reviewSheet;
    }
  }

  const openSheetId = touchControlsAvailable ? sheet.openSheet : null;
  /*
   * A `full` bottom sheet covers the canvas completely, so WorkspaceSheet marks
   * itself `aria-modal`. That claim is only honest if what is behind is
   * genuinely unreachable - otherwise a screen-reader user can virtual-cursor
   * into a shell they cannot see. `inert` is what makes it true, and because
   * inert content is not focusable it also removes the need for a hand-rolled
   * focus trap. At `peek` and `half` the canvas is deliberately still usable,
   * so nothing is inert and nothing claims modality.
   */
  const shellInert = openSheetId !== null && usesBottomSheets && sheet.detent === 'full';

  /**
   * Which control owns the bottom of the screen. The rule lives in
   * @arq/workspace beside the rest of the sheet state, so it is testable
   * without rendering and cannot drift from what the sheet reducer believes.
   */
  const bottomOwner = touchControlsAvailable
    ? phoneBottomOwner(sheet, platform, usesBottomSheets)
    : 'none';

  return (
    <div
      className={`arq-workspace arq-workspace--${platform}`}
      data-workspace-mode={activeMode}
      data-workspace-open-state={project.openState}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/*
       * Doc 51 / WCAG 2.4.1. Without this a keyboard user crosses the project
       * bar, tab strip, mode rail and tool rail - over twenty stops, measured -
       * before reaching the drawing they came to work on.
       */}
      <a href="#arq-workspace-canvas" className="arq-skip-link">
        Skip to canvas
      </a>

      {/*
       * The shell is one element so a full-detent sheet can make it `inert` in
       * a single place. The sheet is rendered as a sibling below, precisely so
       * it stays interactive while everything behind it does not.
       */}
      <div
        className="arq-workspace__shell"
        {...(shellInert ? { inert: '' } : {})}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <div
          className="arq-workspace__bar arq-workspace__bar--project"
          style={{ minHeight: slots.topBar, flex: '0 0 auto' }}
        >
          {phone ? (phoneProjectBar ?? projectBar) : projectBar}
        </div>
        <div
          className="arq-workspace__bar arq-workspace__bar--views"
          style={{ minHeight: viewSwitcherHeightPx(slots), flex: '0 0 auto' }}
        >
          {phone ? (compactViewControl ?? tabStrip) : tabStrip}
        </div>
        {touchControlsAvailable && !phone && (
          <TabletDrawerBar
            openSheet={sheet.openSheet}
            onToggleSheet={onToggleSheet}
            {...(reviewDisabledReason === undefined ? {} : { reviewDisabledReason })}
          />
        )}

        <div
          className="arq-workspace__row"
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            minHeight: 0,
            /*
             * How far in from the row's leading edge the canvas actually
             * starts. A floating panel is absolutely positioned within this
             * row, so without it the left panel begins at the row edge and
             * covers the two rails it is supposed to sit beside.
             */
            ['--arq-rails-width' as string]: `${
              canvasFirst ? 0 : workspaceRailsWidthPx(platform, toolRailIsDock)
            }px`,
          }}
        >
          {!canvasFirst && (
            <ModeRail project={project} activeMode={activeMode} onSelectMode={onSelectMode} />
          )}
          {!canvasFirst && toolRail}

          {browserDocked && (
            <>
              <div
                className="arq-workspace__docked arq-workspace__docked--left"
                style={{ width: panels['project-browser'].widthPx, flex: '0 0 auto', minWidth: 0 }}
              >
                {projectBrowser}
              </div>
              {onResizePanel !== undefined && (
                <PanelResizeHandle
                  panel="project-browser"
                  label="project browser"
                  side="left"
                  widthPx={panels['project-browser'].widthPx}
                  onResize={(width) => onResizePanel('project-browser', width)}
                />
              )}
            </>
          )}

          <main
            id="arq-workspace-canvas"
            tabIndex={-1}
            className="arq-workspace__viewport"
            aria-label="Canvas"
            style={{ flex: 1, minWidth: 0, position: 'relative' }}
          >
            {viewport}
          </main>

          {inspectorDocked && (
            <>
              {onResizePanel !== undefined && (
                <PanelResizeHandle
                  panel="inspector"
                  label="inspector"
                  side="right"
                  widthPx={panels.inspector.widthPx}
                  onResize={(width) => onResizePanel('inspector', width)}
                />
              )}
              <div
                className="arq-workspace__docked arq-workspace__docked--right"
                style={{ width: panels.inspector.widthPx, flex: '0 0 auto', minWidth: 0 }}
              >
                {inspector}
              </div>
            </>
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

          {/* Landscape tablet: side drawers, per doc 46. */}
          {openSheetId !== null && !usesBottomSheets && (
            <OverlayPanel
              side={openSheetId === 'inspector' ? 'right' : 'left'}
              widthPx={
                openSheetId === 'inspector'
                  ? panels.inspector.widthPx
                  : panels['project-browser'].widthPx
              }
              label={SHEET_TITLE[openSheetId]}
              onDismiss={onCloseSheet ?? (() => undefined)}
            >
              {sheetBody(openSheetId)}
            </OverlayPanel>
          )}
        </div>

        {/*
          Doc 09: "no permanent bottom command surface while idle". ContextBar
          returns null when there is no active tool and nothing selected, but a
          null child inside a slot with a `minHeight` still reserves the slot -
          so an idle desktop kept a 38px empty strip pinned under the canvas,
          taking height from the drawing to show nothing. A host that has
          nothing for the bar passes null and the slot goes with it.
        */}
        {!phone && contextBar !== null && (
          <div
            className="arq-workspace__context-bar"
            style={{ minHeight: slots.contextBar ?? 0, flex: '0 0 auto' }}
          >
            {contextBar}
          </div>
        )}
        <div
          className="arq-workspace__bar arq-workspace__bar--status"
          style={{ minHeight: slots.statusBar ?? slots.statusMinimal ?? 0, flex: '0 0 auto' }}
        >
          {statusBar}
        </div>
        {/*
          Doc 47 and the Version 12 layout contract: exactly one bottom
          interaction owner. A raised sheet replaces this bar rather than
          stacking above it - rendering both left the dock focusable and
          hit-testable underneath a peeking sheet.
        */}
        {touchControlsAvailable && bottomOwner === 'review-bar' && (
          <PhoneDock
            openSheet={sheet.openSheet}
            activeToolLabel={activeToolLabel}
            onSelectTool={onSelectPointerTool ?? (() => undefined)}
            onToggleSheet={onToggleSheet}
            {...(reviewDisabledReason === undefined ? {} : { reviewDisabledReason })}
          />
        )}
      </div>

      {/* Portrait tablet and phone: bottom sheets with detents, per doc 47. */}
      {openSheetId !== null && usesBottomSheets && (
        <WorkspaceSheet
          title={SHEET_TITLE[openSheetId]}
          platform={platform}
          detent={sheet.detent}
          viewportHeightPx={probe.heightPx}
          onClose={onCloseSheet ?? (() => undefined)}
          onExpand={onExpandSheet ?? (() => undefined)}
          onCollapse={onCollapseSheet ?? (() => undefined)}
          {...(onSheetDragToDetent === undefined ? {} : { onDragToDetent: onSheetDragToDetent })}
        >
          {sheetBody(openSheetId)}
        </WorkspaceSheet>
      )}
    </div>
  );
}
