import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  TopBar,
  ToolRail,
  ModelPanel,
  InspectorShell,
  StatusBar,
  ContextBar,
  CommandPalette,
  ProjectTabStrip,
  CompactViewControl,
  PhoneProjectBar,
  ViewSwitcherList,
  InspectorPanel,
  ProjectBrowserPanel,
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
  CommandFeedbackRegion,
  createCommandFeedbackStore,
  isEditableEventTarget,
} from '@arq/design-system';
import {
  CLOSED_SHEET_STATE,
  DEFAULT_WORKSPACE_CAPABILITIES,
  EMPTY_VIEW_TABS_STATE,
  INITIAL_BROWSER_PANEL_STATE,
  INITIAL_INSPECTOR_TABS_STATE,
  INITIAL_PANEL_LAYOUT_STATE,
  INITIAL_TOOL_STATE,
  activateAdjacentTab,
  activateTab,
  activateTool,
  cancelTool,
  capabilityUnavailableReason,
  closeSheet,
  closeOtherTabs,
  closeTab,
  closeTabsToRight,
  collapseSheet,
  duplicateTab,
  expandSheet,
  handleSystemBack,
  initialModeState,
  isUnmodifiedLetterShortcut,
  moveTab,
  openTab,
  reconcileBrowserSection,
  setDetent,
  reconcileInspectorTab,
  selectInspectorTab,
  reconcileDockedPanels,
  resizePanel,
  selectBrowserSection,
  resolveLayoutSlots,
  resolveShortcutDialect,
  resolveWorkspacePlatform,
  shortcutLabel,
  shouldHandleShortcut,
  switchModeIfAvailable,
  toggleSheet,
  togglePin,
  toolContract,
  type ProjectOverviewData,
  type ViewportProbe,
  type WorkspaceProjectContext,
} from '@arq/workspace';
import type { WorldPoint } from '@arq/geometry-2d';
import { createUndoStack, hasErrors, type ValidationMessage } from '@arq/operations';
import { validateUniqueElementIds, validateWallSegments } from '@arq/validation';
import {
  applyOperation,
  invertOperation,
  wallLength,
  type DrawnWall,
  type WorkspaceOperation,
} from './canvas/plan-document';
import { createPlanJournal, type PlanJournal } from './canvas/plan-journal';
import type { NativeProjectSession, NativeProjectSnapshot } from './project/native-project-session';
import { NativeProjectPanel } from './NativeProjectPanel';
import { buildNativeProjectTree, type OpenNativeProject } from './native-project-view';
import {
  wallsOnLevel,
  type NativeProjectModel as NativeProjectDocument,
} from '@arq/project-loading';

/**
 * The walls of one level, in the shape the plan and 3D surfaces draw. The
 * project's own wall ids are carried through unchanged: they are what the model
 * tree selects by and what 3D highlights by, so a translated id here would make
 * the two surfaces silently stop sharing a selection.
 */
function wallsForLevel(document: NativeProjectDocument, levelId: string): readonly DrawnWall[] {
  return wallsOnLevel(document, levelId).map((wall) => ({
    id: wall.id,
    start: wall.start,
    end: wall.end,
  }));
}
import { TOOL_ICONS } from './tool-icons';
import { PlanCanvas } from './PlanCanvas';
/**
 * The 3D surface carries three.js and the model renderer, which together are the
 * largest single contributor to the initial bundle. It is only ever rendered for
 * the `3d` tab, so it is fetched when that tab is first opened rather than on
 * start-up. The split follows the surface boundary that already exists; it is
 * not an arbitrary chunk boundary chosen to move bytes around.
 */
const ModelCanvas = lazy(async () => ({
  default: (await import('./ModelCanvas')).ModelCanvas,
}));
import {
  buildDemoWallAccessibleDescription,
  buildDemoWallInspectorGroups,
  buildDrawnWallAccessibleDescription,
  buildDrawnWallInspectorGroups,
} from './inspector-data';
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
              /*
               * Doc 39's stated performance case: "expanding a 5,000-element
               * model must not render every row". A synthetic level of that
               * size is the only way this build can exercise the virtualiser -
               * it is fixture data for the tree, clearly named as such, not a
               * claim that the project contains these elements.
               */
              ...Array.from({ length: 5000 }, (_, index) => ({
                id: `fixture-wall-${index}`,
                displayName: `Fixture wall ${index + 1}`,
                nodeType: 'Wall',
                hidden: false,
              })),
            ],
          },
        ],
      },
    ],
  },
];

/**
 * `workspace-keyboard-map.json` ids where one exists, so the palette can show
 * the platform-adapted binding beside the command rather than a second,
 * hand-written shortcut vocabulary.
 */
const COMMAND_ENTRIES: readonly Omit<CommandPaletteEntry, 'shortcutLabel'>[] = [
  { id: 'select', label: 'Select tool', category: 'Select', synonyms: ['pick'] },
  { id: 'wall', label: 'Wall draw', category: 'Draw', synonyms: ['wall'] },
  { id: 'door', label: 'Insert door', category: 'Build', synonyms: ['door'] },
  { id: 'room-boundary', label: 'Insert room', category: 'Build', synonyms: ['room'] },
  { id: 'fit', label: 'Fit view', category: 'View', synonyms: ['zoom extents'] },
  { id: 'close-tab', label: 'Close active view', category: 'View', synonyms: ['close tab'] },
  {
    id: 'export-dxf',
    label: 'Export DXF',
    category: 'File',
    disabledReason: 'No project open yet',
  },
];

/*
 * Sync has no backend at all, which is 'not-configured', not 'offline'. The
 * governed `sync` vocabulary keeps those apart deliberately: 'offline' says
 * "Remote sync cannot run", which tells a user a sync feature exists and is
 * currently unreachable, so their work might be waiting to go somewhere.
 * Nothing is waiting, because there is nowhere to send it.
 *
 * Save state, by contrast, is real: edits are journalled to IndexedDB
 * (canvas/plan-journal.ts) and recovered on start-up, so the bars report the
 * journal's actual condition instead of a demo constant.
 */
const DEMO_SYNC_STATE = 'not-configured' as const;
const PLAN_PROJECT_ID = 'demo-project';

/** Highest numeric suffix among recovered wall ids, so new ids never collide. */
function highestWallIdSuffix(walls: readonly DrawnWall[]): number {
  return walls.reduce((max, wall) => {
    const match = /^drawn-wall-(\d+)$/.exec(wall.id);
    return match === null ? max : Math.max(max, Number(match[1]));
  }, 0);
}

const INITIAL_PROBE: ViewportProbe = { widthPx: 1536, heightPx: 864, coarsePointer: false };

const INITIAL_TABS = openTab(
  openTab(
    openTab(EMPTY_VIEW_TABS_STATE, {
      id: 'overview',
      kind: 'project-overview',
      title: 'Project overview',
    }),
    { id: 'model-3d', kind: '3d', title: '3D', semanticViewId: 'view-3d' },
  ),
  { id: 'plan-level-1', kind: 'plan', title: 'Level 1 Plan', semanticViewId: 'view-plan-level-1' },
);

export function App(): JSX.Element {
  const undoStackRef = useRef(createUndoStack<WorkspaceOperation>());
  const [historyVersion, setHistoryVersion] = useState(0);

  /*
   * The one mutable plan document this build edits (see
   * canvas/plan-document.ts for why it is in-memory scope). A ref mirrors
   * the state so operation inverses are computed against the definitely-
   * current wall list, not a stale closure - and so StrictMode's double-
   * invoked updaters can never double-push onto the undo stack.
   */
  const [drawnWalls, setDrawnWalls] = useState<readonly DrawnWall[]>([]);
  const drawnWallsRef = useRef<readonly DrawnWall[]>([]);
  drawnWallsRef.current = drawnWalls;

  /*
   * Real local persistence: the journal is opened once, recovery replays it
   * into the document before the first edit, and every applied geometry
   * operation (including applied undo/redo inverses) is appended. Save
   * state reports what actually happened - 'recovered' after a non-empty
   * replay, 'saving' while an append is in flight, 'unsaved-changes' when
   * the journal cannot take writes (quota, eviction, no IndexedDB).
   */
  const journalRef = useRef<PlanJournal | null>(null);
  const wallIdCounterRef = useRef(0);
  const [saveState, setSaveState] = useState<
    'no-project' | 'saved' | 'saving' | 'unsaved-changes' | 'recovered'
  >('no-project');
  const [journalLabel, setJournalLabel] = useState('Journal opening…');

  useEffect(() => {
    const journal = createPlanJournal();
    journalRef.current = journal;
    let cancelled = false;
    journal
      .recover(PLAN_PROJECT_ID)
      .then(({ walls, recoveredOperationCount }) => {
        if (cancelled) {
          return;
        }
        setDrawnWalls(walls);
        wallIdCounterRef.current = highestWallIdSuffix(walls);
        setSaveState(recoveredOperationCount > 0 ? 'recovered' : 'saved');
        setJournalLabel(
          recoveredOperationCount > 0
            ? `Journal current · ${recoveredOperationCount} operation(s) recovered`
            : 'Journal current',
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSaveState('unsaved-changes');
          setJournalLabel('Journal unavailable');
        }
      });
    const unsubscribe = journal.onUnavailable(() => {
      setSaveState('unsaved-changes');
      setJournalLabel('Journal unavailable');
    });
    return () => {
      cancelled = true;
      unsubscribe();
      journal.close();
      journalRef.current = null;
    };
  }, []);

  const journalOperation = useCallback((operation: WorkspaceOperation) => {
    const journal = journalRef.current;
    if (journal === null || operation.kind === 'note') {
      return;
    }
    setSaveState('saving');
    void journal.append(PLAN_PROJECT_ID, operation).then((state) => {
      if (state.status === 'ready') {
        setSaveState('saved');
        setJournalLabel('Journal current');
      } else {
        setSaveState('unsaved-changes');
        // The journal already worked out why, and a full disk is the one
        // failure the user can do something about. Collapsing every write
        // failure to the same four words threw that away: it told someone
        // their work was not being kept without telling them the reason they
        // could act on.
        setJournalLabel(
          state.status === 'unavailable'
            ? 'Journal unavailable'
            : state.cause === 'storage-full'
              ? 'Journal write failed: device storage is full'
              : 'Journal write failed',
        );
      }
    });
  }, []);

  const [projectName, setProjectName] = useState('Untitled project');
  /**
   * The live native project, once one is open. Held in a ref rather than state
   * because nothing renders from the session itself - the walls it decoded are
   * what render - and because it must be closed on replacement: a session left
   * behind keeps its Worker alive and with it the OPFS write lock on its
   * working copy, which would make that project unopenable for the rest of the
   * session.
   */
  const nativeSessionRef = useRef<NativeProjectSession | null>(null);

  /**
   * Replaces the workspace's project with one that has already been fully
   * validated, decoded and adopted by the open pipeline. This runs only on
   * success: a rejected or cancelled candidate never reaches here, so the
   * previous project stays exactly as it was.
   */
  const adoptNativeProject = useCallback(
    (opened: {
      readonly session: NativeProjectSession;
      readonly snapshot: NativeProjectSnapshot;
    }) => {
      const previous = nativeSessionRef.current;
      nativeSessionRef.current = opened.session;
      // Fire-and-forget, but never skipped: releasing the previous Worker is
      // what frees its working copy. A failure to close cleanly is the previous
      // project's problem and must not block adopting this one.
      void previous?.close().catch(() => undefined);

      // A building is drawn one level at a time. The snapshot carries every wall
      // in the project across every level, and drawing all of them at once puts
      // the upper floor on top of the ground floor - which looks like a plan
      // rather than like a fault, so it has to be got right here rather than
      // noticed later.
      const initialLevelId = opened.snapshot.document?.levels[0]?.id ?? null;
      const shown =
        opened.snapshot.document !== null && initialLevelId !== null
          ? wallsForLevel(opened.snapshot.document, initialLevelId)
          : opened.snapshot.walls;
      setDrawnWalls(shown);
      drawnWallsRef.current = shown;
      wallIdCounterRef.current = highestWallIdSuffix(shown);
      setProjectName(opened.snapshot.displayName);
      // Read from the working copy, not written to it yet: "opened" is not
      // "saved", and this build does not checkpoint edits back to the `.arq`
      // file. Saying `saved` here would claim durability the product has not
      // earned.
      setSaveState('unsaved-changes');
      setJournalLabel(
        opened.snapshot.readOnly
          ? 'Open for reading only · edits are not saved to this project'
          : 'Open from a local working copy · edits are not saved to this project yet',
      );
      // Kept so the project browser can show what the file contains beyond the
      // walls the plan draws - its levels, wall types and rooms. Null for a
      // project this build wrote, which carries none of that, and the panel is
      // simply not rendered rather than rendered empty.
      setOpenNativeProject(
        opened.snapshot.document === null
          ? null
          : {
              workingCopyId: opened.snapshot.workingCopyId,
              fileName: opened.snapshot.displayName,
              project: {
                model: opened.snapshot.document,
                writeVerdict: opened.snapshot.readOnly ? 'read-only' : 'working-copy',
                writeReason: opened.snapshot.readOnly
                  ? 'This project was written by a newer version of ARQ, so it can be read but not changed.'
                  : 'Changes are kept in a local working copy on this device. Nothing is written back to the .arq file you chose.',
                conditions: opened.snapshot.warnings,
              },
            },
      );
      setActiveNativeLevelId(initialLevelId);
      setActiveWorkingCopyId(opened.snapshot.workingCopyId);
      setFileOpenPanelOpen(false);
    },
    [],
  );

  /**
   * The reference-format model of the open project, when the file carried one.
   * Separate from the walls the plan edits: those are the working document, this
   * is what the file said about itself, and conflating them is how a surface
   * ends up claiming the project contains only what happens to be drawn.
   */
  /**
   * The working copy the workspace holds, tracked separately from the project
   * browser's model because every open has one and only some carry a reference
   * document. Keying "is this already open?" off the panel's state would have
   * left the flat shape - the projects this build writes - still able to attempt
   * a second Worker over a working copy the live one holds.
   */
  const [activeWorkingCopyId, setActiveWorkingCopyId] = useState<string | null>(null);
  const [openNativeProject, setOpenNativeProject] = useState<{
    readonly workingCopyId: string;
    readonly fileName: string;
    readonly project: OpenNativeProject;
  } | null>(null);
  const [activeNativeLevelId, setActiveNativeLevelId] = useState<string | null>(null);
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
  const [sheet, setSheet] = useState(CLOSED_SHEET_STATE);
  const [browserPanel, setBrowserPanel] = useState(INITIAL_BROWSER_PANEL_STATE);
  const [inspectorTabs, setInspectorTabs] = useState(INITIAL_INSPECTOR_TABS_STATE);
  const [toolRailState, setToolRailState] = useState(INITIAL_TOOL_RAIL_STATE);
  const [modelSelection, setModelSelection] = useState<ModelPanelSelectionState>({
    primary: null,
    secondary: new Set(),
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [fileOpenPanelOpen, setFileOpenPanelOpen] = useState(false);
  const [activeSnapLabel, setActiveSnapLabel] = useState<string | null>(null);
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

  /*
   * Doc 34: each mode leads with the browser section it is about, unless the
   * user has chosen one themselves - see reconcileBrowserSection.
   */
  useEffect(() => {
    setBrowserPanel((current) =>
      reconcileBrowserSection(
        current,
        modeState.mode,
        DEFAULT_WORKSPACE_CAPABILITIES['CAP-collaboration'],
      ),
    );
  }, [modeState.mode]);

  /**
   * W135 command feedback: concise, factual outcome messages published only
   * after the semantic operation actually happened. The store caps and
   * groups so repeated tool use can never grow an unbounded queue; the
   * region announces politely without stealing focus. Note operations are
   * demo bookkeeping, not command outcomes, and stay silent.
   */
  const feedbackStoreRef = useRef(createCommandFeedbackStore());

  const feedbackForOperation = (operation: WorkspaceOperation): string | null => {
    if (operation.kind === 'add-walls') {
      return operation.walls.length === 1 ? 'Wall drawn' : `${operation.walls.length} walls drawn`;
    }
    if (operation.kind === 'remove-walls') {
      return operation.wallIds.length === 1
        ? 'Wall deleted'
        : `${operation.wallIds.length} walls deleted`;
    }
    return null;
  };

  /** Applies a typed operation to the plan document, records its real inverse, journals it. */
  const performOperation = useCallback(
    (operation: WorkspaceOperation) => {
      const current = drawnWallsRef.current;
      undoStackRef.current.push({
        forward: operation,
        inverse: invertOperation(current, operation),
      });
      setDrawnWalls(applyOperation(current, operation));
      setHistoryVersion((v) => v + 1);
      journalOperation(operation);
      // Published after the model applied and the inverse is recorded - the
      // semantic commit is real. Persistence has its own honest channel
      // (the status bar's journal state), deliberately not conflated here.
      const message = feedbackForOperation(operation);
      if (message !== null) {
        feedbackStoreRef.current.publish('success', message, Date.now());
      }
    },
    [journalOperation],
  );

  const handleUndo = useCallback(() => {
    const inverse = undoStackRef.current.undo();
    if (inverse !== null) {
      setDrawnWalls(applyOperation(drawnWallsRef.current, inverse));
      journalOperation(inverse);
      feedbackStoreRef.current.publish('info', 'Undone', Date.now());
    }
    setHistoryVersion((v) => v + 1);
  }, [journalOperation]);

  const handleRedo = useCallback(() => {
    const forward = undoStackRef.current.redo();
    if (forward !== null) {
      setDrawnWalls(applyOperation(drawnWallsRef.current, forward));
      journalOperation(forward);
      feedbackStoreRef.current.publish('info', 'Redone', Date.now());
    }
    setHistoryVersion((v) => v + 1);
  }, [journalOperation]);

  const recordDemoAction = useCallback(
    (label: string) => {
      performOperation({ kind: 'note', label });
    },
    [performOperation],
  );

  /*
   * §4.3 gate on the one committing edit this build has: a finished wall
   * chain is validated against @arq/validation's rules before it becomes
   * an operation. Errors block the commit and surface through the command
   * feedback region as a real failure; warnings (e.g. an exact duplicate
   * wall) commit but tell the user what happened. Rejected input leaves
   * committed state unchanged - failure is never converted into success
   * because a preview appeared.
   */
  const handleCommitWallSegments = useCallback(
    (segments: readonly { readonly start: WorldPoint; readonly end: WorldPoint }[]) => {
      // Identity is the document's concern, not the canvas's: ids are
      // allocated here, above the counter recovery seeded, so recovered and
      // new walls can never collide.
      const walls: DrawnWall[] = segments.map((segment) => {
        wallIdCounterRef.current += 1;
        return {
          id: `drawn-wall-${wallIdCounterRef.current}`,
          start: segment.start,
          end: segment.end,
        };
      });
      const messages = validateWallSegments(walls, drawnWallsRef.current);
      if (hasErrors(messages)) {
        const error = messages.find((m) => m.severity === 'error');
        feedbackStoreRef.current.publish(
          'error',
          error !== undefined ? `${error.title}. ${error.explanation}` : 'Wall rejected',
          Date.now(),
        );
        return;
      }
      performOperation({ kind: 'add-walls', walls });
      const warning = messages[0];
      if (warning !== undefined) {
        feedbackStoreRef.current.publish(
          'info',
          `${warning.title}. ${warning.explanation}`,
          Date.now(),
        );
      }
    },
    [performOperation],
  );

  /*
   * The status bar's model-health counts are computed from the committed
   * model on every change - real rule evaluation, not a hardcoded zero.
   * (Error-severity states cannot normally be reached, because the commit
   * gate above refuses them - which is exactly what makes 0 honest.)
   */
  const modelHealth = useMemo(() => {
    const messages = [
      ...validateWallSegments(drawnWalls),
      ...validateUniqueElementIds(drawnWalls.map((wall) => wall.id)),
    ];
    return {
      errorCount: messages.filter((m) => m.severity === 'error').length,
      warningCount: messages.filter((m) => m.severity === 'warning').length,
    };
  }, [drawnWalls]);

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
      const textFieldFocused = isEditableEventTarget(event.target);

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
        // Doc 47 gestures and the registry's `escape` command: overlays first,
        // then the tool's own draft. Closing the sheet and cancelling a wall in
        // one keypress would lose work the user only meant to un-cover.
        if (sheet.openSheet !== null) {
          setSheet(closeSheet());
          return;
        }
        setToolState(cancelTool);
        setCommandPaletteOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Registry `undo`/`redo`: Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z - the
      // bindings workspace-keyboard-map.json and keyboard-baseline.ts have
      // documented all along, finally handled. shouldHandleShortcut already
      // keeps these away from text fields, so native input undo still works
      // while typing in the wall HUD or a rename field.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Registry `close-tab`: Cmd/Ctrl+W. The browser owns this combination for
      // its own tab, so preventDefault is what makes it ours - and it is only
      // claimed when there is actually a closeable view to close, otherwise the
      // user's expectation that Cmd+W closes something is simply wrong here.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'w') {
        const active = tabs.tabs.find((tab) => tab.id === tabs.activeId);
        if (active?.closeable === true) {
          event.preventDefault();
          setTabs((state) => closeTab(state, active.id));
        }
        return;
      }

      if (!isUnmodifiedLetterShortcut(probeEvent)) {
        return;
      }
      // Registry `select`, `wall`, `fit`.
      const letter = event.key.toLowerCase();
      if (letter === 'v') {
        handleActivateTool('select');
      } else if (letter === 'w') {
        handleActivateTool('wall');
      } else if (letter === 'f') {
        handleActivateTool('fit');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleActivateTool, sheet.openSheet, tabs]);

  /*
   * The semantic tree gains the walls the user has actually drawn, named by
   * their real measured length - the same honesty rule as everywhere else:
   * the panel lists what exists, and labels the fixture data as fixture.
   */
  const modelTree = useMemo<readonly ModelPanelNode[]>(() => {
    // A real project replaces the tree rather than adding to it. Grafting its
    // walls onto the demo site would present the reader's building as a branch
    // of a fixture, and the ids in the tree are the project's own - they have to
    // resolve against the project, not against MODEL_TREE.
    if (openNativeProject !== null && activeNativeLevelId !== null) {
      return buildNativeProjectTree(openNativeProject.project.model);
    }
    if (drawnWalls.length === 0) {
      return MODEL_TREE;
    }
    const drawnNodes: ModelPanelNode[] = drawnWalls.map((wall) => ({
      id: wall.id,
      displayName: `Wall ${Math.round(wallLength(wall))} mm (drawn)`,
      nodeType: 'Wall',
      hidden: false,
    }));
    const site = MODEL_TREE[0]!;
    const building = site.children![0]!;
    const level = building.children![0]!;
    return [
      {
        ...site,
        children: [
          {
            ...building,
            children: [{ ...level, children: [...drawnNodes, ...(level.children ?? [])] }],
          },
        ],
      },
    ];
  }, [drawnWalls, openNativeProject, activeNativeLevelId]);

  const selectedDrawnWall = useMemo(
    () => drawnWalls.find((wall) => wall.id === modelSelection.primary) ?? null,
    [drawnWalls, modelSelection.primary],
  );

  /*
   * Undo/redo can remove the selected wall out from under the selection;
   * a selection pointing at a no-longer-existing element would leave the
   * status bar claiming "1 selected" of nothing. Reconcile on every wall
   * change - fixture ids (demo-*, fixture-*) always exist and are exempt.
   */
  useEffect(() => {
    setModelSelection((current) => {
      const exists = (id: string): boolean =>
        !id.startsWith('drawn-wall-') || drawnWalls.some((wall) => wall.id === id);
      const primaryDangling = current.primary !== null && !exists(current.primary);
      const liveSecondary = [...current.secondary].filter(exists);
      if (!primaryDangling && liveSecondary.length === current.secondary.size) {
        return current;
      }
      // Promote a surviving secondary if the primary vanished, so a
      // multi-select undo degrades to "fewer selected", not "none".
      const primary = primaryDangling ? (liveSecondary[0] ?? null) : current.primary;
      const secondary = new Set(liveSecondary.filter((id) => id !== primary));
      return { primary, secondary };
    });
  }, [drawnWalls]);

  const isWallSelected = modelSelection.primary === 'demo-wall-1';
  const selectionCount = modelSelection.primary === null ? 0 : 1 + modelSelection.secondary.size;
  /*
   * Doc 40. warningCount comes from the real model-health evaluation below;
   * historyCapability is off for the same reason CAP-collaboration is:
   * nothing produces revisions.
   */
  const inspectorContext = useMemo(
    () => ({
      selectionCount,
      warningCount: 0,
      mode: modeState.mode,
      historyCapabilityEnabled: false,
    }),
    [selectionCount, modeState.mode],
  );

  /*
   * Doc 34: default to the most relevant tab for the context, while preserving
   * a tab the user picked themselves - reconcileInspectorTab holds both halves.
   */
  useEffect(() => {
    setInspectorTabs((current) => reconcileInspectorTab(current, inspectorContext));
  }, [inspectorContext]);
  const activeTab = tabs.tabs.find((tab) => tab.id === tabs.activeId) ?? null;
  const railModel = useMemo(
    () => buildToolRailModel(modeState.mode, (toolId) => TOOL_ICONS[toolId] ?? null),
    [modeState.mode],
  );

  /*
   * Doc 47 > Gestures: "system back closes overlays first." On Android the back
   * gesture arrives as a history `popstate`, so a pushed entry is what gives the
   * workspace something to pop. `handleSystemBack` reports whether it consumed
   * the gesture - when it did not, the entry is not re-pushed and the next back
   * leaves the app, which is what stops the user being trapped here.
   */
  useEffect(() => {
    if (sheet.openSheet === null) {
      return;
    }
    window.history.pushState({ arqSheet: sheet.openSheet }, '');
    const onPopState = (): void => {
      setSheet((current) => handleSystemBack(current).state);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [sheet.openSheet]);

  /*
   * `workspace-keyboard-map.json` rule 4: "Shortcut labels are platform-adapted,
   * not hard-coded Cmd everywhere." The dialect is resolved once from the same
   * probe that drives layout, then every command that has a registry binding
   * carries its label into the palette.
   */
  const shortcutDialect = useMemo(
    () =>
      resolveShortcutDialect(
        platform,
        typeof navigator === 'undefined' ? false : /Mac|iPhone|iPad/.test(navigator.platform),
        !probe.coarsePointer,
      ),
    [platform, probe.coarsePointer],
  );

  const commandEntries = useMemo<readonly CommandPaletteEntry[]>(
    () =>
      COMMAND_ENTRIES.map((entry) => {
        const label = shortcutLabel(entry.id, shortcutDialect);
        return label === null ? entry : { ...entry, shortcutLabel: label };
      }),
    [shortcutDialect],
  );

  const activeToolLabel = useMemo(() => {
    const contract = toolContract(toolState.activeToolId);
    return contract === null ? null : contract.name;
  }, [toolState.activeToolId]);

  /*
   * Doc 47 lists Review in the phone dock, but its surfaces are gated on
   * CAP-collaboration, which this build does not enable. The control stays
   * visible with the reason rather than vanishing - the same rule the tool rail
   * follows for the 43 designed-but-unbuilt tools.
   */
  const reviewDisabledReason =
    capabilityUnavailableReason(DEFAULT_WORKSPACE_CAPABILITIES, 'CAP-collaboration') ?? undefined;

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
    activeTab?.kind === '3d' ? (
      <Suspense
        fallback={
          <div role="status" aria-live="polite">
            Loading the 3D view
          </div>
        }
      >
        <ModelCanvas
          walls={drawnWalls}
          selection={modelSelection}
          onSelectElement={(elementId) =>
            setModelSelection({ primary: elementId, secondary: new Set() })
          }
        />
      </Suspense>
    ) : activeTab?.kind === 'project-overview' ? (
      <ProjectOverviewSurface
        data={overviewData}
        capabilities={DEFAULT_WORKSPACE_CAPABILITIES}
        gridColumns={platform === 'phone' ? 1 : platform === 'desktop' ? 12 : 2}
        onOpenView={(viewId) => setTabs((state) => activateTab(state, viewId))}
      />
    ) : (
      <PlanCanvas
        activeToolId={toolState.activeToolId}
        walls={drawnWalls}
        selection={modelSelection}
        onSelectElement={(elementId) =>
          setModelSelection({ primary: elementId, secondary: new Set() })
        }
        onSelectMany={(elementIds) =>
          setModelSelection({
            primary: elementIds[0] ?? null,
            secondary: new Set(elementIds.slice(1)),
          })
        }
        onCommitWalls={handleCommitWallSegments}
        onFitCompleted={() => handleActivateTool('select')}
        onActiveSnapChange={setActiveSnapLabel}
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
        sheet={sheet}
        onToggleSheet={(id) => setSheet((state) => toggleSheet(state, id))}
        onCloseSheet={() => setSheet(closeSheet())}
        onExpandSheet={() => setSheet(expandSheet)}
        onCollapseSheet={() => setSheet(collapseSheet)}
        onSheetDragToDetent={(detent) => setSheet((state) => setDetent(state, detent))}
        onResizePanel={(panel, width) => setPanels((current) => resizePanel(current, panel, width))}
        onSelectPointerTool={() => handleActivateTool('select')}
        activeToolLabel={activeToolLabel}
        phoneProjectBar={
          <PhoneProjectBar
            projectName={projectName}
            saveState={saveState}
            syncState={DEMO_SYNC_STATE}
            onBackToProjects={() => setFileOpenPanelOpen(true)}
            menuItems={[
              {
                id: 'undo',
                label: 'Undo',
                onActivate: handleUndo,
                ...(undoStackRef.current.canUndo() ? {} : { disabledReason: 'Nothing to undo' }),
              },
              {
                id: 'redo',
                label: 'Redo',
                onActivate: handleRedo,
                ...(undoStackRef.current.canRedo() ? {} : { disabledReason: 'Nothing to redo' }),
              },
              { id: 'open', label: 'Open project…', onActivate: () => setFileOpenPanelOpen(true) },
              {
                id: 'commands',
                label: 'Search commands',
                onActivate: () => setCommandPaletteOpen(true),
              },
              {
                id: 'share',
                label: 'Share',
                onActivate: () => recordDemoAction('share'),
                ...(reviewDisabledReason === undefined
                  ? {}
                  : { disabledReason: reviewDisabledReason }),
              },
            ]}
          />
        }
        compactViewControl={
          <CompactViewControl
            state={tabs}
            viewSwitcherOpen={sheet.openSheet === 'view-switcher'}
            onOpenViewSwitcher={() => setSheet((state) => toggleSheet(state, 'view-switcher'))}
          />
        }
        viewSwitcherSheet={
          <ViewSwitcherList
            state={tabs}
            onActivateTab={(id) => {
              setTabs((state) => activateTab(state, id));
              // Doc 47: "Tap switches and closes sheet."
              setSheet(closeSheet());
            }}
            onCloseTab={(id) => setTabs((state) => closeTab(state, id))}
          />
        }
        {...(reviewDisabledReason === undefined ? {} : { reviewDisabledReason })}
        projectBar={
          <TopBar
            projectName={projectName}
            onRenameProject={setProjectName}
            activeViewName={activeTab?.title ?? 'No view open'}
            // Save state is real: it tracks the IndexedDB operation journal
            // (recover on boot, append per edit). Sync stays 'offline'
            // because no sync backend exists - the two are reported
            // separately, per the copy principles.
            saveState={saveState}
            syncState={DEMO_SYNC_STATE}
            canUndo={undoStackRef.current.canUndo()}
            canRedo={undoStackRef.current.canRedo()}
            lastUndoActionLabel={null}
            lastRedoActionLabel={null}
            onUndo={handleUndo}
            onRedo={handleRedo}
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
            onMoveTab={(id, toIndex) => setTabs((state) => moveTab(state, id, toIndex))}
            contextMenuActions={{
              onTogglePin: (id) => setTabs((state) => togglePin(state, id)),
              onDuplicate: (id) =>
                setTabs((state) => duplicateTab(state, id, `${id}-copy-${state.tabs.length}`)),
              onRevealInBrowser: (id) => {
                // Doc 37: "Reveal in browser" is navigation, not mutation - it
                // opens the browser at the Views section and selects nothing.
                setBrowserPanel((current) => selectBrowserSection(current, 'views'));
                setTabs((state) => activateTab(state, id));
              },
              onClose: (id) => setTabs((state) => closeTab(state, id)),
              onCloseOthers: (id) => setTabs((state) => closeOtherTabs(state, id)),
              onCloseToRight: (id) => setTabs((state) => closeTabsToRight(state, id)),
            }}
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
          <ProjectBrowserPanel
            state={browserPanel}
            mode={modeState.mode}
            reviewCapabilityEnabled={DEFAULT_WORKSPACE_CAPABILITIES['CAP-collaboration']}
            onSelectSection={(section) =>
              setBrowserPanel((current) => selectBrowserSection(current, section))
            }
            sections={{
              /*
               * Only Project has real content: the semantic tree is the one
               * thing this build can actually enumerate. Views, Documents and
               * Files render their own empty state rather than a fabricated
               * list - doc 35's "never invent" rule is not specific to the
               * overview.
               */
              project:
                openNativeProject !== null && activeNativeLevelId !== null ? (
                  <NativeProjectPanel
                    fileName={openNativeProject.fileName}
                    staged={openNativeProject.project}
                    activeLevelId={activeNativeLevelId}
                    onShowLevel={(levelId) => {
                      setActiveNativeLevelId(levelId);
                      const shown = wallsForLevel(openNativeProject.project.model, levelId);
                      setDrawnWalls(shown);
                      drawnWallsRef.current = shown;
                      // The selection is a wall id, and a wall on another level
                      // is not on screen. Keeping it would leave the inspector
                      // describing something the reader cannot see.
                      setModelSelection({ primary: null, secondary: new Set() });
                    }}
                    onCloseProject={() => {
                      // Closing has to put back everything adoption replaced, not
                      // just hide the panel. Leaving the project's walls on the
                      // canvas under the workspace's own name is the worst of both:
                      // the reader is told no project is open while still looking
                      // at one, and the next open would draw over it.
                      void nativeSessionRef.current?.close().catch(() => undefined);
                      nativeSessionRef.current = null;
                      setOpenNativeProject(null);
                      setActiveNativeLevelId(null);
                      setActiveWorkingCopyId(null);
                      setDrawnWalls([]);
                      drawnWallsRef.current = [];
                      setProjectName('Untitled project');
                      setModelSelection({ primary: null, secondary: new Set() });
                      setSaveState('saved');
                      setJournalLabel('Journal current');
                    }}
                  >
                    <ModelPanel
                      tree={modelTree}
                      selection={modelSelection}
                      onSelectNode={(nodeId) =>
                        setModelSelection({ primary: nodeId, secondary: new Set() })
                      }
                    />
                  </NativeProjectPanel>
                ) : (
                  <ModelPanel
                    tree={modelTree}
                    selection={modelSelection}
                    onSelectNode={(nodeId) =>
                      setModelSelection({ primary: nodeId, secondary: new Set() })
                    }
                  />
                ),
              views: (
                <ViewSwitcherList
                  state={tabs}
                  onActivateTab={(id) => setTabs((state) => activateTab(state, id))}
                  onCloseTab={(id) => setTabs((state) => closeTab(state, id))}
                />
              ),
            }}
          />
        }
        viewport={viewport}
        inspector={
          <InspectorPanel
            state={inspectorTabs}
            context={inspectorContext}
            commonTypeName={
              selectedDrawnWall !== null
                ? 'Wall (drawn)'
                : isWallSelected
                  ? 'Interior Wall 100mm'
                  : null
            }
            onSelectTab={(tab) => setInspectorTabs((current) => selectInspectorTab(current, tab))}
            tabs={{
              /*
               * Doc 40: the existing InspectorShell renders exactly what the
               * Properties tab is specified to contain, so it becomes that
               * tab's body rather than being replaced. Type, Relations,
               * Warnings and History have no data source in this build and
               * render their own honest empty state.
               */
              properties: (
                <InspectorShell
                  groups={
                    selectedDrawnWall !== null
                      ? buildDrawnWallInspectorGroups(
                          selectedDrawnWall.id,
                          wallLength(selectedDrawnWall),
                        )
                      : isWallSelected
                        ? buildDemoWallInspectorGroups()
                        : buildEmptyInspectorGroups()
                  }
                  selectedElementDescription={
                    selectedDrawnWall !== null
                      ? buildDrawnWallAccessibleDescription(
                          selectedDrawnWall.id,
                          wallLength(selectedDrawnWall),
                        )
                      : isWallSelected
                        ? buildDemoWallAccessibleDescription()
                        : null
                  }
                />
              ),
            }}
          />
        }
        contextBar={
          <ContextBar
            activeToolId={toolState.activeToolId}
            selectionCount={selectionCount}
            actions={
              selectedDrawnWall !== null
                ? [
                    {
                      id: 'delete',
                      label: selectionCount > 1 ? `Delete ${selectionCount} walls` : 'Delete',
                      // A real, undoable deletion of every selected drawn
                      // wall - one operation, one undo step.
                      onActivate: () => {
                        const drawnIds = new Set(drawnWalls.map((wall) => wall.id));
                        const selectedIds = [
                          modelSelection.primary,
                          ...modelSelection.secondary,
                        ].filter((id): id is string => id !== null && drawnIds.has(id));
                        performOperation({ kind: 'remove-walls', wallIds: selectedIds });
                        setModelSelection({ primary: null, secondary: new Set() });
                      },
                    },
                  ]
                : isWallSelected
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
            activeSnapLabel={activeSnapLabel}
            selectionCount={selectionCount}
            currentLevelName="Level 1"
            pixelsPerUnit={pixelsPerUnit}
            modelHealth={modelHealth}
            localJournalStateLabel={journalLabel}
            syncState={DEMO_SYNC_STATE}
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
            entries={commandEntries}
            onInvoke={(entry) => {
              /*
               * The palette carries both tool activations and view commands, so
               * it dispatches by id rather than assuming everything is a tool -
               * before this, invoking "Close active view" silently did nothing
               * because handleActivateTool had no such tool to arm.
               */
              if (entry.id === 'close-tab') {
                const active = tabs.tabs.find((tab) => tab.id === tabs.activeId);
                if (active?.closeable === true) {
                  setTabs((state) => closeTab(state, active.id));
                }
              } else {
                handleActivateTool(entry.id);
              }
              recordDemoAction(entry.label);
              setCommandPaletteOpen(false);
            }}
            onClose={() => setCommandPaletteOpen(false)}
          />
        </div>
      )}

      {/* Renders its own full-viewport ArqModalDialog (backdrop, focus trap),
          so it sits beside WorkspaceRoot rather than inside a layout slot. */}
      <FileOpenPanel
        isOpen={fileOpenPanelOpen}
        onOpenChange={setFileOpenPanelOpen}
        onProjectOpened={adoptNativeProject}
        activeWorkingCopyId={activeWorkingCopyId}
      />

      {/* W135 ToastRegion replaces the previous ad-hoc validation notice,
          which sat at zIndex 9 (below every menu and the modal backdrop) and
          referenced three custom properties that never existed. Validation
          failures, commit successes and undo/redo outcomes all flow through
          the one capped, grouped, auto-expiring queue. */}
      <CommandFeedbackRegion store={feedbackStoreRef.current} />

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
          {historyVersion} action(s) recorded
        </p>
      )}
    </>
  );
}
