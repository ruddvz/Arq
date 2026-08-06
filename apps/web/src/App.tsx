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
  isContextBarVisible,
  createCommandFeedbackStore,
  isEditableEventTarget,
  ArqModalDialog,
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
  setPanelOpen,
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
import {
  browserCopyDelivery,
  deliverPublishedCopy,
  publishedCopyFileName,
} from './project/deliver-published-copy';
import {
  describeDeliveryFailure,
  describePublicationOutcome,
  type PublicationOutcomeDescription,
} from './project/describe-publication-outcome';
import { NativeProjectPanel } from './NativeProjectPanel';
import { buildNativeProjectTree, type OpenNativeProject } from './native-project-view';
import {
  roomsOnLevel,
  wallTypeFor,
  wallsOnLevel,
  type NativeProjectModel as NativeProjectDocument,
} from '@arq/project-loading';
import type { WallSolidDimensions } from './ModelCanvas';
import type { PlanRoom } from './canvas/canvas-interaction';
import { roomLabelText, type PlanOpeningInput, type PlanScene } from '@arq/plan-renderer';
import { exportPlanSheet, PAPER_SIZES } from './sheets/sheet-export';
import type { ModelOpeningSpan } from './ModelCanvas';

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

/**
 * Thickness and height per wall id, read from each wall's own type.
 *
 * Both surfaces already accept this and neither was being given it, so a
 * project's "Exterior 250 mm" walls drew as hairlines in plan and extruded at a
 * borrowed demo default in 3D. The wall type is the only place those numbers
 * exist, and reading them per wall rather than per level is what lets one
 * storey mix exterior and partition types - which the golden fixture does.
 */
function wallDimensionsForLevel(
  document: NativeProjectDocument,
  levelId: string,
): ReadonlyMap<string, WallSolidDimensions> {
  const dimensions = new Map<string, WallSolidDimensions>();
  for (const wall of wallsOnLevel(document, levelId)) {
    const type = wallTypeFor(document, wall);
    if (type === null) {
      continue;
    }
    dimensions.set(wall.id, {
      thicknessMm: type.thickness.value,
      heightMm: type.defaultHeight.value,
    });
  }
  return dimensions;
}

/**
 * The hosted openings each wall on a level carries, in the shape the plan
 * surface draws.
 *
 * Keyed by wall rather than returned as a flat list because that is how an
 * opening is positioned: its offset is measured along its host wall's
 * centreline, so the wall has to be in hand before the opening means anything.
 *
 * The door's side, hand and swing come from the Door record and the window's
 * side from the Window record, because the Opening itself is only the void -
 * which is the same split the canonical model keeps, and the reason a door and
 * a window hosted in identical openings still draw differently.
 */
/**
 * One opening, carrying what both surfaces need.
 *
 * Kept as one record rather than derived twice because plan and 3D read the
 * same opening and differ only in which fields they use: plan needs the swing
 * and ignores the sill, 3D needs the sill and has no swing. Two derivations
 * would let the two views disagree about where an opening is, which is the one
 * disagreement neither view can show.
 */
type LevelOpening = PlanOpeningInput & ModelOpeningSpan;

function wallOpeningsForLevel(
  document: NativeProjectDocument,
  levelId: string,
): ReadonlyMap<string, readonly LevelOpening[]> {
  const wallIds = new Set(wallsOnLevel(document, levelId).map((wall) => wall.id as string));
  const doorsByOpening = new Map(
    document.doors.map((door) => [door.openingId as string, door] as const),
  );
  const windowsByOpening = new Map(
    document.windows.map((window) => [window.openingId as string, window] as const),
  );

  const byWall = new Map<string, LevelOpening[]>();
  for (const opening of document.openings) {
    const hostId = opening.hostWallId as string;
    // Openings are model-wide; only the ones hosted by a wall on the level
    // being drawn belong on this drawing.
    if (!wallIds.has(hostId)) continue;

    const door = doorsByOpening.get(opening.id as string);
    const window = windowsByOpening.get(opening.id as string);
    const placed: LevelOpening = {
      id: opening.id as string,
      kind: opening.kind,
      offsetFromWallStart: opening.offsetFromWallStart.value,
      width: opening.width.value,
      sillHeight: opening.sillHeight.value,
      height: opening.height.value,
      ...(door === undefined
        ? window === undefined
          ? {}
          : { side: window.side }
        : { side: door.side, hand: door.hand, swingAngle: door.swingAngle }),
    };
    const existing = byWall.get(hostId);
    if (existing === undefined) byWall.set(hostId, [placed]);
    else existing.push(placed);
  }
  return byWall;
}

/**
 * The rooms of one level, in the shape the plan surface draws.
 *
 * Without this the plan drew a project's walls and none of its rooms - the
 * golden fixture's ground floor is 37 walls and 18 rooms, and only the walls
 * appeared - while the workspace's own demo room went on being drawn on top,
 * label and all. PlanCanvas's own contract says an opened project passes its
 * rooms and the fixture "is not rendered at all", because "a demo room drawn
 * over someone's house would be a lie about their model". Nothing was passing
 * them.
 *
 * Area comes from the model rather than being recomputed here: the room label
 * has to agree with what the inspector and schedules say, and two independent
 * area calculations is how they stop agreeing.
 */
function roomsForLevel(document: NativeProjectDocument, levelId: string): readonly PlanRoom[] {
  return roomsOnLevel(document, levelId).map((room) => ({
    id: room.id,
    // `calculatedArea` is already square metres - `recalculateRoomArea` stores
    // the result of `roomAreaSquareMetres`. Converting again here read every
    // room in the golden fixture as "0.0 m2".
    /*
     * Two lines, which is what `roomLabelText` in @arq/plan-renderer has built
     * since it was written and what nothing was using: name on one, area on the
     * next. As one line it was twice as wide as it needed to be, and that width
     * is most of why labels collided at small scales.
     */
    label: roomLabelText({
      elementId: room.id as string,
      seedPoint: room.seedPoint,
      name: room.name ?? 'Room',
      areaSquareMetres: room.calculatedArea,
    }),
    polygon: room.calculatedBoundary,
  }));
}
import { MODE_ICONS, TOOL_GROUP_ICONS, TOOL_ICONS, TOP_BAR_ACTION_ICONS } from './tool-icons';
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
  buildDrawnWallSelectionAccessibleDescription,
  buildDrawnWallSelectionInspectorGroups,
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
              /*
               * No invented children. An "Interior Wall 100mm" and a "Room
               * 4.20 x 3.60" used to sit here so the tree had something in it.
               * Neither existed anywhere else in the application - selecting
               * the wall showed an Inspector describing a wall that was not on
               * the canvas, and the room named a rectangle the plan drew from
               * its own separate constant. A tree that lists nothing when there
               * is nothing is the honest empty state, and the walls a user
               * draws appear below by their real measured length.
               */
              /*
               * Five thousand synthetic `Fixture wall N` rows used to sit here,
               * on the grounds that they were "the only way this build can
               * exercise the virtualiser". They were not: `visibleModelTreeRows`
               * has its own unit test, which windows a tree without rendering
               * anything and without shipping the rows to a reader.
               *
               * What they did do was dominate the first screen of every session
               * - fifteen rows of invented walls above the fold, under a real
               * project's heading - which reads as the product's content rather
               * than as a test aid. An opened project replaces this tree with
               * canonical data; until then the tree should be small and true.
               */
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
  /*
   * Portable publication, and the first command in this list that reaches the
   * `.arq` tier rather than the in-memory document. Its `disabledReason` is
   * filled in per render rather than fixed here: it depends on whether a native
   * project is open, which is the difference between a command a user can run
   * and one that would refuse the moment it started.
   */
  { id: 'save-a-copy', label: 'Save a copy', category: 'File', synonyms: ['export', 'download'] },
  /*
   * Vector sheet export. Like `save-a-copy`, its availability is state rather
   * than a constant: there has to be something on the plan to put on a sheet.
   */
  {
    id: 'export-sheet-pdf',
    label: 'Export sheet as PDF',
    category: 'File',
    synonyms: ['sheet', 'print', 'plot'],
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
  /**
   * The open project's rooms for the level on show, or null when no project is
   * open. Null and empty mean different things to the plan surface: null asks
   * for the workspace's own demo fixture, an empty list draws no rooms at all.
   */
  const [projectRooms, setProjectRooms] = useState<readonly PlanRoom[] | null>(null);
  /** Thickness and height per wall id for the level on show; empty with no project open. */
  const [wallOpenings, setWallOpenings] = useState<ReadonlyMap<string, readonly LevelOpening[]>>(
    () => new Map(),
  );
  const [wallDimensions, setWallDimensions] = useState<ReadonlyMap<string, WallSolidDimensions>>(
    new Map(),
  );

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
      setProjectRooms(
        opened.snapshot.document !== null && initialLevelId !== null
          ? roomsForLevel(opened.snapshot.document, initialLevelId)
          : [],
      );
      setWallDimensions(
        opened.snapshot.document !== null && initialLevelId !== null
          ? wallDimensionsForLevel(opened.snapshot.document, initialLevelId)
          : new Map(),
      );
      setWallOpenings(
        opened.snapshot.document !== null && initialLevelId !== null
          ? wallOpeningsForLevel(opened.snapshot.document, initialLevelId)
          : new Map(),
      );
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
  /*
   * Canvas-first once there is room for it: the drawing runs the full width of
   * the workspace and the panels rest on top, rather than each taking a column
   * and boxing the model in. Below that width the panels would cover more of
   * the canvas than they freed, so the docked composition is the better answer
   * and stays the default.
   */
  const workspaceComposition = platform === 'desktop' ? 'floating' : 'docked';

  // Every category has a glyph, so the rail renders as a dock and the floor
  // has to be told the narrower width.
  const railsWidthPx = workspaceRailsWidthPx(platform, true);
  useEffect(() => {
    setPanels((current) =>
      reconcileDockedPanels(current, {
        viewportWidthPx: probe.widthPx,
        slots,
        railsWidthPx,
        platform,
        composition: workspaceComposition,
      }),
    );
  }, [probe.widthPx, slots, railsWidthPx, platform, workspaceComposition]);

  /*
   * The Inspector follows the selection.
   *
   * It was docked open permanently, so roughly 300px of a 1600px window was
   * given over to the words "No selection" whenever nothing was selected -
   * which is most of the time, and is the single largest thing the drawing was
   * losing width to. The reference composition shows it only when there is
   * something to inspect, and the canvas runs to the window edge otherwise.
   *
   * Driven from selection rather than from a user preference because that is
   * what it is: a panel about the selected element has nothing to say when
   * there is no selected element. Toggling it by hand still works, until the
   * selection changes again and answers the question for itself.
   */
  const hasSelection = modelSelection.primary !== null || modelSelection.secondary.size > 0;
  useEffect(() => {
    setPanels((current) => setPanelOpen(current, 'inspector', hasSelection));
  }, [hasSelection]);

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
   * The outcome of the last "Save a copy", held until the user dismisses it.
   *
   * Deliberately not routed through the command-feedback toasts alone. Those
   * expire after four seconds and carry a title only, and a publication refusal
   * is the one message in this app where the diagnostic and the "your work is
   * still here" sentence are the whole point - a user who misses them is left
   * believing their project is damaged. So the toast stays as the transient
   * acknowledgement and the full description gets a dialog the user closes.
   */
  const [publicationNotice, setPublicationNotice] = useState<PublicationOutcomeDescription | null>(
    null,
  );
  const [savingCopy, setSavingCopy] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  /**
   * The plan scene the canvas last built, so a sheet exports the drawing on
   * screen rather than a second projection of the same model that could
   * disagree with it. A ref because nothing renders from it.
   */
  const planSceneRef = useRef<{
    readonly primitives: PlanScene<string>['primitives'];
    readonly bounds: {
      readonly min: { readonly x: number; readonly y: number };
      readonly max: { readonly x: number; readonly y: number };
    };
  } | null>(null);

  /**
   * Publishes the open project to a verified portable file and hands it over.
   *
   * The order is the contract: `publish` returns bytes only after an
   * independent reader has opened them and matched project, revision and
   * semantic hash, so nothing reaches the browser until the copy has been
   * proved. A refusal at any step hands over nothing at all, which is what lets
   * the failure copy tell the user their work is untouched.
   */
  const handleSaveCopy = useCallback(async (): Promise<void> => {
    const session = nativeSessionRef.current;
    if (session === null || savingCopy) return;

    const fileName = publishedCopyFileName(session.snapshot().displayName);
    setSavingCopy(true);
    try {
      const result = await session.publish();
      const described = describePublicationOutcome(result, fileName);
      if (result.status !== 'published') {
        setPublicationNotice(described);
        feedbackStoreRef.current.publish('error', described.headline, Date.now());
        return;
      }

      const delivered = deliverPublishedCopy(result.bytes, fileName, browserCopyDelivery(document));
      if (delivered.status === 'failed') {
        const failure = describeDeliveryFailure(delivered.detail);
        setPublicationNotice(failure);
        feedbackStoreRef.current.publish('error', failure.headline, Date.now());
        return;
      }

      setPublicationNotice(described);
      feedbackStoreRef.current.publish('success', described.headline, Date.now());
    } catch (error) {
      // A thrown publish is the read-only refusal or a closed session, neither
      // of which produced a file. Reported as a delivery-side failure rather
      // than as a verification one, because no verification ran.
      const failure = describeDeliveryFailure(
        error instanceof Error ? error.message : String(error),
      );
      setPublicationNotice(failure);
      feedbackStoreRef.current.publish('error', failure.headline, Date.now());
    } finally {
      setSavingCopy(false);
    }
  }, [savingCopy]);

  /**
   * Exports what is on the plan as a vector PDF sheet.
   *
   * The scene comes from the canvas rather than being rebuilt here, so the
   * sheet carries exactly the drawing on screen - the same walls, poché,
   * openings and labels - instead of a second projection that could disagree
   * with it. The export's real limits travel with the result and are shown, not
   * logged: a PDF that quietly substitutes a font and flattens line weights
   * looks finished, and a user discovers otherwise at the printer.
   */
  const handleExportSheet = useCallback(async (): Promise<void> => {
    const scene = planSceneRef.current;
    if (scene === null || scene.primitives.length === 0 || exportingSheet) return;

    setExportingSheet(true);
    try {
      const active = tabs.tabs.find((tab) => tab.id === tabs.activeId);
      const result = await exportPlanSheet({
        scene: { primitives: scene.primitives },
        projectName,
        sheetNumber: 'A101',
        sheetTitle: active?.title ?? 'Plan',
        paper: PAPER_SIZES.A1,
        scaleDenominator: 100,
        contentBounds: scene.bounds,
      });
      const delivered = deliverPublishedCopy(
        result.bytes,
        result.fileName,
        browserCopyDelivery(document),
        'application/pdf',
      );
      if (delivered.status === 'failed') {
        feedbackStoreRef.current.publish('error', 'No sheet was exported.', Date.now());
        setPublicationNotice({
          headline: 'No sheet was exported.',
          detail: `The sheet was written but this browser did not accept the download. (${delivered.detail})`,
          tone: 'error',
        });
        return;
      }
      feedbackStoreRef.current.publish('success', `Exported ${result.fileName}.`, Date.now());
      setPublicationNotice({
        headline: `Exported ${result.fileName}.`,
        detail: `This sheet is vector linework, not a screenshot. What it does not do yet: ${result.limitations.join(' ')}`,
        tone: 'success',
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      feedbackStoreRef.current.publish('error', 'No sheet was exported.', Date.now());
      setPublicationNotice({
        headline: 'No sheet was exported.',
        detail: `The sheet could not be written. (${detail})`,
        tone: 'error',
      });
    } finally {
      setExportingSheet(false);
    }
  }, [exportingSheet, projectName, tabs]);

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
   * Frame the project when one is adopted.
   *
   * Doc 09 requires that camera changes come from an explicit view command, and
   * this is one: the fit tool, dispatched by id, the same command the rail and
   * the palette send. Without it the drawing kept whatever view the empty
   * workspace had - the golden fixture opened at 16% with most of the house
   * outside the viewport, which reads as a broken renderer rather than as a
   * camera that was never asked to move.
   */
  useEffect(() => {
    if (openNativeProject === null) {
      return;
    }
    handleActivateTool('fit');
  }, [openNativeProject, handleActivateTool]);

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

  /**
   * Every selected drawn wall, not just the primary one.
   *
   * The inspector used to receive only the primary and describe it under a
   * heading saying how many were selected, so a reader checking a length got an
   * answer about a wall they had not asked about. The merge in
   * buildDrawnWallSelectionInspectorGroups is what makes a disagreeing property
   * read as "Multiple values" instead.
   */
  const selectedDrawnWalls = useMemo(() => {
    const ids = [modelSelection.primary, ...modelSelection.secondary].filter(
      (id): id is string => id !== null,
    );
    const byId = new Map(drawnWalls.map((wall) => [wall.id, wall]));
    return ids
      .map((id) => byId.get(id))
      .filter((wall): wall is DrawnWall => wall !== undefined)
      .map((wall) => ({ id: wall.id, lengthMm: wallLength(wall) }));
  }, [drawnWalls, modelSelection]);

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

  /*
   * There is no longer a demo wall to select. What used to be here -
   * `modelSelection.primary === 'demo-wall-1'` - gated an Inspector describing
   * a wall that existed in no document, and a Delete action that journalled a
   * note instead of deleting anything. Both went with the node.
   */
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

  /*
   * "Save a copy" is the only entry whose availability is state, not a
   * constant: it publishes the `.arq` working copy, which exists only while a
   * native project is open. Shown with its reason rather than hidden, which is
   * the rule the tool rail already follows - a command that vanishes teaches a
   * user it was never there.
   */
  const exportSheetDisabledReason =
    projectRooms === null && drawnWalls.length === 0
      ? 'Draw something or open a project to export a sheet'
      : exportingSheet
        ? 'Exporting a sheet'
        : undefined;

  const saveCopyDisabledReason =
    openNativeProject === null
      ? 'Open a project file to save a copy of it'
      : savingCopy
        ? 'Saving a copy'
        : undefined;

  const commandEntries = useMemo<readonly CommandPaletteEntry[]>(
    () =>
      COMMAND_ENTRIES.map((entry) => {
        const label = shortcutLabel(entry.id, shortcutDialect);
        const withShortcut = label === null ? entry : { ...entry, shortcutLabel: label };
        if (entry.id === 'save-a-copy' && saveCopyDisabledReason !== undefined) {
          return { ...withShortcut, disabledReason: saveCopyDisabledReason };
        }
        if (entry.id === 'export-sheet-pdf' && exportSheetDisabledReason !== undefined) {
          return { ...withShortcut, disabledReason: exportSheetDisabledReason };
        }
        return withShortcut;
      }),
    [shortcutDialect, saveCopyDisabledReason, exportSheetDisabledReason],
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

  /*
   * The level actually on show, and the scale actually being drawn at.
   *
   * The status bar said "Level 1" whatever level was open - a constant written
   * into a readout whose whole job is to say where the reader is. With the
   * golden fixture open on its upper floor it was simply wrong.
   *
   * The scale is derived from the viewport rather than declared, and the
   * derivation is worth writing out because it is easy to invert - the first
   * version read "1:5" for a fourteen-metre house drawn across six hundred
   * pixels, which is off by a factor of sixteen and looks plausible enough to
   * ship.
   *
   * One CSS pixel is 25.4/96 mm of paper and covers 1/pixelsPerUnit mm of
   * world. A drawing scale is paper to world, so the denominator is world over
   * paper: (1 / pixelsPerUnit) / (25.4 / 96), which is 96 / (25.4 *
   * pixelsPerUnit). The label moves when the reader zooms, which is the only
   * way it can stay true.
   */
  const activeLevelName =
    openNativeProject === null || activeNativeLevelId === null
      ? null
      : (openNativeProject.project.model.levels.find(
          (level) => (level.id as string) === activeNativeLevelId,
        )?.name ?? null);

  const planScaleLabel =
    pixelsPerUnit > 0 && Number.isFinite(pixelsPerUnit)
      ? `1:${Math.round(96 / (25.4 * pixelsPerUnit))}`
      : null;

  /**
   * The view's own identity, pinned to the corner of the drawing.
   *
   * The reference plans carry it and ours did not: which view this is, what
   * kind of drawing it is, and at what scale. Without it the canvas is a
   * drawing with no title - a reader who opens a project on the wrong level, or
   * reads a 1:200 plan as 1:100, has nothing on screen telling them so.
   *
   * Every part of it is read from state rather than written down: the level
   * comes from the open project, the scale from the viewport's own zoom. A
   * hard-coded "1:100" would be exactly the kind of decoration this work has
   * been removing.
   */
  const viewIdentity =
    activeTab === null ? null : (
      <div className="arq-view-identity">
        <strong>{activeLevelName ?? activeTab.title}</strong>
        <span>
          {activeTab.kind === '3d' ? 'Model' : 'Plan'}
          {planScaleLabel === null ? '' : ` \u00b7 ${planScaleLabel}`}
        </span>
      </div>
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
          // The same dimensions and the same openings the plan is drawn from.
          // 3D extruded at a single borrowed default before this, so an opened
          // project's own wall types reached the plan and not the model.
          wallDimensions={wallDimensions}
          wallOpenings={wallOpenings}
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
      <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
        {viewIdentity}
        <PlanCanvas
          activeToolId={toolState.activeToolId}
          walls={drawnWalls}
          {...(projectRooms === null ? {} : { rooms: projectRooms })}
          wallDimensions={wallDimensions}
          wallOpenings={wallOpenings}
          onSceneBuilt={(scene) => {
            planSceneRef.current = scene;
          }}
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
      </div>
    );

  return (
    <>
      <WorkspaceRoot
        modeIcons={MODE_ICONS}
        project={project}
        activeMode={modeState.mode}
        onSelectMode={(mode) => setModeState((state) => switchModeIfAvailable(state, mode))}
        probe={probe}
        toolRailIsDock
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
            actionIcons={TOP_BAR_ACTION_ICONS}
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
            categoryIcons={TOOL_GROUP_ICONS}
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
                      setProjectRooms(roomsForLevel(openNativeProject.project.model, levelId));
                      setWallDimensions(
                        wallDimensionsForLevel(openNativeProject.project.model, levelId),
                      );
                      setWallOpenings(
                        wallOpeningsForLevel(openNativeProject.project.model, levelId),
                      );
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
                      setProjectRooms(null);
                      setWallDimensions(new Map());
                      setWallOpenings(new Map());
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
            commonTypeName={selectedDrawnWalls.length > 0 ? 'Wall (drawn)' : null}
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
                    selectedDrawnWalls.length > 0
                      ? buildDrawnWallSelectionInspectorGroups(selectedDrawnWalls)
                      : buildEmptyInspectorGroups()
                  }
                  selectedElementDescription={
                    selectedDrawnWalls.length > 0
                      ? buildDrawnWallSelectionAccessibleDescription(selectedDrawnWalls)
                      : null
                  }
                />
              ),
            }}
          />
        }
        contextBar={
          /*
           * Doc 09: the shell reserves the bottom slot only when something
           * occupies it, so the decision is made here rather than left to the
           * bar rendering null inside a slot that still holds its height. The
           * rule itself is ContextBar's own, reused rather than restated.
           */
          !isContextBarVisible(toolState.activeToolId, selectionCount) ? null : (
            <ContextBar
              activeToolId={toolState.activeToolId}
              selectionCount={selectionCount}
              actions={
                selectedDrawnWalls.length > 0
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
                  : []
              }
            />
          )
        }
        statusBar={
          <StatusBar
            unitLabel="mm"
            cursorWorldPosition={cursorWorldPosition}
            activeSnapLabel={activeSnapLabel}
            selectionCount={selectionCount}
            currentLevelName={activeLevelName ?? 'Level 1'}
            pixelsPerUnit={pixelsPerUnit}
            modelHealth={modelHealth}
            localJournalStateLabel={journalLabel}
            syncState={DEMO_SYNC_STATE}
            supportModeEnabled={false}
            /* Doc 47: the phone strip carries only what a review-first phone
               can act on; save and sync live on the phone project bar. */
            variant={platform === 'phone' ? 'minimal' : 'full'}
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
              } else if (entry.id === 'export-sheet-pdf') {
                void handleExportSheet();
                setCommandPaletteOpen(false);
                return;
              } else if (entry.id === 'save-a-copy') {
                // Returns before `recordDemoAction`: saving a copy reads the
                // project and does not change it, and journalling a note here
                // would move the project to "unsaved changes" for an action
                // that changed nothing.
                void handleSaveCopy();
                setCommandPaletteOpen(false);
                return;
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

      {/*
        The outcome of a "Save a copy", shown until the user closes it.

        Not dismissable by clicking away: on a refusal this is the only place
        that carries the diagnostic and the sentence saying the project on this
        device still holds every change, and a stray click on the canvas behind
        it would take both away.
      */}
      <ArqModalDialog
        isOpen={publicationNotice !== null}
        onOpenChange={(open) => {
          if (!open) setPublicationNotice(null);
        }}
        isDismissable={false}
        aria-labelledby="arq-publication-notice-heading"
      >
        {({ close }) => (
          <div style={{ display: 'grid', gap: 'var(--arq-space-panel)', maxWidth: '46ch' }}>
            <h2 id="arq-publication-notice-heading" style={{ font: 'var(--arq-text-panel-title)' }}>
              {publicationNotice?.headline ?? ''}
            </h2>
            <p style={{ color: 'var(--arq-ui-text-secondary)' }}>
              {publicationNotice?.detail ?? ''}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="arq-shell-button" onClick={close}>
                Close
              </button>
            </div>
          </div>
        )}
      </ArqModalDialog>

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
