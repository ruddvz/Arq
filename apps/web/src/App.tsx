import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  TopBar,
  ToolRail,
  ModelPanel,
  InspectorShell,
  StatusBar,
  ContextBar,
  CommandPalette,
  ProjectTabStrip,
  ProjectOverviewSurface,
  WorkspaceRoot,
  buildToolRailModel,
  workspaceRailsWidthPx,
  useViewportProbe,
  INITIAL_TOOL_RAIL_STATE,
  toggleCategory,
  selectTool,
  buildEmptyInspectorGroups,
  type ModelPanelNode,
  type ModelPanelSelectionState,
  type CommandPaletteEntry,
  type ToolRailCategory,
} from '@arq/design-system';
import {
  DEFAULT_WORKSPACE_CAPABILITIES,
  EMPTY_VIEW_TABS_STATE,
  INITIAL_PANEL_LAYOUT_STATE,
  INITIAL_TOOL_STATE,
  activateAdjacentTab,
  activateTab,
  activateTool,
  cancelTool,
  closeTab,
  initialModeState,
  isUnmodifiedLetterShortcut,
  openTab,
  reconcileDockedPanels,
  resolveLayoutSlots,
  resolveWorkspacePlatform,
  shouldHandleShortcut,
  switchModeIfAvailable,
  togglePin,
  type ProjectOverviewData,
  type ViewportProbe,
  type WorkspaceProjectContext,
} from '@arq/workspace';
import { createUndoStack } from '@arq/operations';
import {
  AlignIcon,
  CommentIcon,
  CopyIcon,
  CrossingSelectIcon,
  DimensionIcon,
  DoorIcon,
  ElevationIcon,
  ExtendIcon,
  FitIcon,
  GridIcon,
  JoinIcon,
  MirrorIcon,
  ModelHealthIcon,
  MoveIcon,
  OffsetIcon,
  OrbitIcon,
  OrthographicIcon,
  PanIcon,
  PerspectiveIcon,
  RevisionIcon,
  RoomIcon,
  RotateIcon,
  SectionIcon,
  SelectIcon,
  SplitIcon,
  TextNoteIcon,
  TrimIcon,
  WallIcon,
  WindowIcon,
  WindowSelectIcon,
} from '@arq/icons';
import { PlanCanvas } from './PlanCanvas';
import { buildDemoWallAccessibleDescription, buildDemoWallInspectorGroups } from './inspector-data';
import { FileOpenPanel } from './file-handling/FileOpenPanel';

/**
 * Package 3.0 doc 33: an open project is one persistent workspace, not a set of
 * unrelated pages. This app is that workspace's host - it owns the state and
 * hands it to @arq/design-system's shell components, which is why every
 * reducer imported above comes from @arq/workspace rather than being written
 * here.
 *
 * The project below is still the repository's demo fixture. It is labelled as
 * one: doc 35's rule is "never invent project metrics to fill a card", so the
 * overview surface receives only the fields this build can actually answer -
 * which today is the recent-view list and nothing else. No model-health card,
 * no issue counts, no activity feed, because no engine produces them yet.
 */

/**
 * Registry tool id -> the icon @arq/icons actually ships for it.
 *
 * Partial by design. `workspace-icon-registry.json` inventories 215 glyphs and
 * says of the ones this repository does not have that they "must be produced
 * through the same icon workflow as the existing ARQ family" - so the tools
 * with no entry here render as a text label rather than a borrowed or
 * approximated glyph. Doc 48's own note applies: an automatically generated
 * placeholder vector is not ARQ artwork.
 */
const TOOL_ICONS: Readonly<Record<string, ReactNode>> = {
  select: <SelectIcon width={16} height={16} />,
  'window-select': <WindowSelectIcon width={16} height={16} />,
  'crossing-select': <CrossingSelectIcon width={16} height={16} />,
  wall: <WallIcon width={16} height={16} />,
  grid: <GridIcon width={16} height={16} />,
  door: <DoorIcon width={16} height={16} />,
  window: <WindowIcon width={16} height={16} />,
  'room-boundary': <RoomIcon width={16} height={16} />,
  move: <MoveIcon width={16} height={16} />,
  copy: <CopyIcon width={16} height={16} />,
  rotate: <RotateIcon width={16} height={16} />,
  mirror: <MirrorIcon width={16} height={16} />,
  offset: <OffsetIcon width={16} height={16} />,
  align: <AlignIcon width={16} height={16} />,
  trim: <TrimIcon width={16} height={16} />,
  extend: <ExtendIcon width={16} height={16} />,
  join: <JoinIcon width={16} height={16} />,
  split: <SplitIcon width={16} height={16} />,
  dimension: <DimensionIcon width={16} height={16} />,
  'text-note': <TextNoteIcon width={16} height={16} />,
  'section-marker': <SectionIcon width={16} height={16} />,
  'elevation-marker': <ElevationIcon width={16} height={16} />,
  pan: <PanIcon width={16} height={16} />,
  orbit: <OrbitIcon width={16} height={16} />,
  fit: <FitIcon width={16} height={16} />,
  perspective: <PerspectiveIcon width={16} height={16} />,
  orthographic: <OrthographicIcon width={16} height={16} />,
  comment: <CommentIcon width={16} height={16} />,
  'model-health': <ModelHealthIcon width={16} height={16} />,
  'compare-revisions': <RevisionIcon width={16} height={16} />,
};

const MODEL_TREE: readonly ModelPanelNode[] = [
  {
    id: 'site-1',
    displayName: 'Site',
    nodeType: 'Site',
    hidden: false,
    children: [
      {
        id: 'building-1',
        displayName: 'Building',
        nodeType: 'Building',
        hidden: false,
        children: [
          {
            id: 'level-1',
            displayName: 'Level 1',
            nodeType: 'Level',
            hidden: false,
            children: [
              {
                id: 'demo-wall-1',
                displayName: 'Interior Wall 100mm',
                nodeType: 'Wall',
                hidden: false,
              },
              { id: 'demo-room', displayName: 'Room 4.20 x 3.60', nodeType: 'Room', hidden: false },
            ],
          },
        ],
      },
    ],
  },
];

const COMMAND_ENTRIES: readonly CommandPaletteEntry[] = [
  { id: 'wall', label: 'Wall draw', category: 'Draw', synonyms: ['wall'] },
  { id: 'door', label: 'Insert door', category: 'Build', synonyms: ['door'] },
  { id: 'room-boundary', label: 'Insert room', category: 'Build', synonyms: ['room'] },
  {
    id: 'export-dxf',
    label: 'Export DXF',
    category: 'File',
    disabledReason: 'No project open yet',
  },
];

const INITIAL_PROBE: ViewportProbe = { widthPx: 1536, heightPx: 864, coarsePointer: false };

const INITIAL_TABS = openTab(
  openTab(EMPTY_VIEW_TABS_STATE, {
    id: 'overview',
    kind: 'project-overview',
    title: 'Project overview',
  }),
  { id: 'plan-level-1', kind: 'plan', title: 'Level 1 Plan', semanticViewId: 'view-plan-level-1' },
);

export function App(): JSX.Element {
  const undoStackRef = useRef(createUndoStack<string>());
  const [historyVersion, setHistoryVersion] = useState(0);

  const [projectName, setProjectName] = useState('Untitled project');
  const [modeState, setModeState] = useState(() =>
    initialModeState({
      projectId: 'demo-project',
      projectName: 'Untitled project',
      documentRevision: 'rev-0',
      openState: 'project-ready',
      saveSync: { local: 'saved-local', sync: 'not-configured' },
      readOnly: false,
    }),
  );
  const [tabs, setTabs] = useState(INITIAL_TABS);
  const [panels, setPanels] = useState(INITIAL_PANEL_LAYOUT_STATE);
  const [toolState, setToolState] = useState(INITIAL_TOOL_STATE);
  const [toolRailState, setToolRailState] = useState(INITIAL_TOOL_RAIL_STATE);
  const [modelSelection, setModelSelection] = useState<ModelPanelSelectionState>({
    primary: null,
    secondary: new Set(),
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [fileOpenPanelOpen, setFileOpenPanelOpen] = useState(false);
  const [cursorWorldPosition, setCursorWorldPosition] = useState<{
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const [pixelsPerUnit, setPixelsPerUnit] = useState(1);

  const probe = useViewportProbe(INITIAL_PROBE);
  const platform = resolveWorkspacePlatform(probe);
  const slots = resolveLayoutSlots(probe);

  const project: WorkspaceProjectContext = useMemo(
    () => ({ ...modeState.project, projectName }),
    [modeState.project, projectName],
  );

  /*
   * Doc 36's canvas floor. Re-run on every probe change rather than only on
   * mount: the failure this prevents is a user dragging their window narrower
   * and watching the canvas be squeezed to nothing while both panels stay
   * docked.
   *
   * `railsWidthPx` is the shell's real rail width, not the registry's - see
   * `workspaceRailsWidthPx`. Passing the registry allowance here would make the
   * floor fire ~150px later than it should.
   */
  const railsWidthPx = workspaceRailsWidthPx(platform);
  useEffect(() => {
    setPanels((current) =>
      reconcileDockedPanels(current, {
        viewportWidthPx: probe.widthPx,
        slots,
        railsWidthPx,
        platform,
      }),
    );
  }, [probe.widthPx, slots, railsWidthPx, platform]);

  const recordDemoAction = useCallback((label: string) => {
    undoStackRef.current.push({ forward: label, inverse: `Undo ${label}` });
    setHistoryVersion((v) => v + 1);
  }, []);

  const handleActivateTool = useCallback(
    (toolId: string) => {
      setToolState((current) => activateTool(current, toolId, modeState.mode));
    },
    [modeState.mode],
  );

  const handleSelectTool = useCallback(
    (category: ToolRailCategory, toolId: string) => {
      setToolRailState((state) => selectTool(state, category, toolId));
      handleActivateTool(toolId);
    },
    [handleActivateTool],
  );

  /*
   * `workspace-keyboard-map.json`'s rules, applied at the one place the app
   * listens: never during IME composition, never while a text field owns the
   * key, and never for a combination the browser or OS already claims.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target;
      const textFieldFocused =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const probeEvent = {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        isComposing: event.isComposing,
      };

      if (!shouldHandleShortcut(probeEvent, { textFieldFocused })) {
        return;
      }

      if (event.key === 'Escape') {
        setToolState(cancelTool);
        setCommandPaletteOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (!isUnmodifiedLetterShortcut(probeEvent)) {
        return;
      }
      if (event.key.toLowerCase() === 'v') {
        handleActivateTool('select');
      } else if (event.key.toLowerCase() === 'w') {
        handleActivateTool('wall');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleActivateTool]);

  const isWallSelected = modelSelection.primary === 'demo-wall-1';
  const activeTab = tabs.tabs.find((tab) => tab.id === tabs.activeId) ?? null;
  const railModel = useMemo(
    () => buildToolRailModel(modeState.mode, (toolId) => TOOL_ICONS[toolId] ?? null),
    [modeState.mode],
  );

  /*
   * Doc 35: only the sections this build can actually answer. `recentViews` is
   * real - it is the open tab list. Model health, issues, activity and recovery
   * are omitted entirely rather than passed as zeros, so the overview shows
   * what exists and says nothing about what does not.
   */
  const overviewData: ProjectOverviewData = useMemo(
    () => ({
      projectName,
      recentViews: tabs.tabs
        .filter((tab) => tab.kind !== 'project-overview')
        .map((tab) => ({ id: tab.id, title: tab.title, kind: tab.kind })),
    }),
    [projectName, tabs.tabs],
  );

  const viewport =
    activeTab?.kind === 'project-overview' ? (
      <ProjectOverviewSurface
        data={overviewData}
        capabilities={DEFAULT_WORKSPACE_CAPABILITIES}
        gridColumns={platform === 'phone' ? 1 : platform === 'desktop' ? 12 : 2}
        onOpenView={(viewId) => setTabs((state) => activateTab(state, viewId))}
      />
    ) : (
      <PlanCanvas
        onPointerWorldPositionChange={setCursorWorldPosition}
        onViewportPixelsPerUnitChange={setPixelsPerUnit}
      />
    );

  return (
    <>
      <WorkspaceRoot
        project={project}
        activeMode={modeState.mode}
        onSelectMode={(mode) => setModeState((state) => switchModeIfAvailable(state, mode))}
        probe={probe}
        panels={panels}
        projectBar={
          <TopBar
            projectName={projectName}
            onRenameProject={setProjectName}
            activeViewName={activeTab?.title ?? 'No view open'}
            // Honest, not decorative: this shell has no save pipeline and no
            // sync backend wired up. FileOpenPanel's gate reports whether a
            // file is safe to open, but nothing opens a project yet, so
            // claiming "Saved"/"Synced" would be exactly the fabricated status
            // the project's own rules forbid - and would collapse save and sync
            // into one false reassurance.
            saveState="no-project"
            syncState="offline"
            canUndo={undoStackRef.current.canUndo()}
            canRedo={undoStackRef.current.canRedo()}
            lastUndoActionLabel={null}
            lastRedoActionLabel={null}
            onUndo={() => {
              undoStackRef.current.undo();
              setHistoryVersion((v) => v + 1);
            }}
            onRedo={() => {
              undoStackRef.current.redo();
              setHistoryVersion((v) => v + 1);
            }}
            onOpenProject={() => setFileOpenPanelOpen(true)}
            onShare={() => recordDemoAction('share')}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenAccountMenu={() => recordDemoAction('open account menu')}
          />
        }
        tabStrip={
          <ProjectTabStrip
            state={tabs}
            // Doc 37 overflow is width-driven; the strip itself does not
            // measure, so the host derives slots from the layout it is in.
            visibleSlots={platform === 'phone' ? 1 : platform === 'desktop' ? 8 : 4}
            onActivateTab={(id) => setTabs((state) => activateTab(state, id))}
            onCloseTab={(id) => setTabs((state) => closeTab(state, id))}
            onTogglePin={(id) => setTabs((state) => togglePin(state, id))}
            onActivateAdjacent={(delta) => setTabs((state) => activateAdjacentTab(state, delta))}
          />
        }
        toolRail={
          <ToolRail
            toolsByCategory={railModel.toolsByCategory}
            visibleCategories={railModel.visibleCategories}
            state={toolRailState}
            onToggleCategory={(category) =>
              setToolRailState((state) => toggleCategory(state, category))
            }
            onSelectTool={handleSelectTool}
          />
        }
        projectBrowser={
          <ModelPanel
            tree={MODEL_TREE}
            selection={modelSelection}
            onSelectNode={(nodeId) => setModelSelection({ primary: nodeId, secondary: new Set() })}
          />
        }
        viewport={viewport}
        inspector={
          <InspectorShell
            groups={isWallSelected ? buildDemoWallInspectorGroups() : buildEmptyInspectorGroups()}
            selectedElementDescription={
              isWallSelected ? buildDemoWallAccessibleDescription() : null
            }
          />
        }
        contextBar={
          <ContextBar
            activeToolId={toolState.activeToolId}
            selectionCount={modelSelection.primary === null ? 0 : 1}
            actions={
              isWallSelected
                ? [
                    {
                      id: 'delete',
                      label: 'Delete',
                      onActivate: () => recordDemoAction('delete wall'),
                    },
                  ]
                : []
            }
          />
        }
        statusBar={
          <StatusBar
            unitLabel="mm"
            cursorWorldPosition={cursorWorldPosition}
            activeSnapLabel={null}
            selectionCount={modelSelection.primary === null ? 0 : 1}
            currentLevelName="Level 1"
            pixelsPerUnit={pixelsPerUnit}
            modelHealth={{ errorCount: 0, warningCount: 0 }}
            localJournalStateLabel="Journal current"
            syncState="offline"
            supportModeEnabled={false}
          />
        }
      />

      {commandPaletteOpen && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--arq-space-page)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
        >
          <CommandPalette
            entries={COMMAND_ENTRIES}
            onInvoke={(entry) => {
              handleActivateTool(entry.id);
              recordDemoAction(entry.label);
              setCommandPaletteOpen(false);
            }}
            onClose={() => setCommandPaletteOpen(false)}
          />
        </div>
      )}

      {/* Renders its own full-viewport ArqModalDialog (backdrop, focus trap),
          so it sits beside WorkspaceRoot rather than inside a layout slot. */}
      <FileOpenPanel isOpen={fileOpenPanelOpen} onOpenChange={setFileOpenPanelOpen} />

      {historyVersion > 0 && (
        <p
          style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            margin: 0,
            fontSize: '0.75em',
            color: 'var(--arq-ui-text-muted)',
          }}
        >
          {historyVersion} demo action(s) recorded
        </p>
      )}
    </>
  );
}
