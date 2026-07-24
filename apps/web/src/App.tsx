import { useCallback, useRef, useState } from 'react';
import {
  TopBar,
  ToolRail,
  ModelPanel,
  InspectorShell,
  StatusBar,
  ContextBar,
  CommandPalette,
  INITIAL_TOOL_RAIL_STATE,
  toggleCategory,
  selectTool,
  buildEmptyInspectorGroups,
  type ModelPanelNode,
  type ModelPanelSelectionState,
  type CommandPaletteEntry,
  type ToolRailCategory,
} from '@arq/design-system';
import { createUndoStack } from '@arq/operations';
import { WallIcon, DoorIcon, RoomIcon, SelectIcon, DimensionIcon, PlanIcon } from '@arq/icons';
import { PlanCanvas } from './PlanCanvas';
import { buildDemoWallAccessibleDescription, buildDemoWallInspectorGroups } from './inspector-data';
import { FileOpenPanel } from './file-handling/FileOpenPanel';

const TOOLS_BY_CATEGORY = {
  select: [{ id: 'select', label: 'Select', icon: <SelectIcon width={16} height={16} /> }],
  draw: [{ id: 'wall-draw', label: 'Wall', icon: <WallIcon width={16} height={16} /> }],
  build: [
    { id: 'door-place', label: 'Door', icon: <DoorIcon width={16} height={16} /> },
    { id: 'room-place', label: 'Room', icon: <RoomIcon width={16} height={16} /> },
  ],
  modify: [],
  annotate: [
    { id: 'dimension', label: 'Dimension', icon: <DimensionIcon width={16} height={16} /> },
  ],
  measure: [],
  view: [{ id: 'plan-view', label: 'Plan', icon: <PlanIcon width={16} height={16} /> }],
} as const;

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
  { id: 'wall-draw', label: 'Wall draw', category: 'Draw', synonyms: ['wall'] },
  { id: 'door-place', label: 'Insert door', category: 'Build', synonyms: ['door'] },
  { id: 'room-place', label: 'Insert room', category: 'Build', synonyms: ['room'] },
  { id: 'dimension', label: 'Add dimension', category: 'Annotate', synonyms: ['measure'] },
  {
    id: 'export-dxf',
    label: 'Export DXF',
    category: 'File',
    disabledReason: 'No project open yet',
  },
];

export function App(): JSX.Element {
  const undoStackRef = useRef(createUndoStack<string>());
  const [historyVersion, setHistoryVersion] = useState(0);

  const [projectName, setProjectName] = useState('Untitled project');
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

  const recordDemoAction = useCallback((label: string) => {
    undoStackRef.current.push({ forward: label, inverse: `Undo ${label}` });
    setHistoryVersion((v) => v + 1);
  }, []);

  const handleSelectTool = useCallback(
    (category: ToolRailCategory, toolId: string) => {
      setToolRailState((state) => selectTool(state, category, toolId));
      recordDemoAction(`select tool ${toolId}`);
    },
    [recordDemoAction],
  );

  const isWallSelected = modelSelection.primary === 'demo-wall-1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar
        projectName={projectName}
        onRenameProject={setProjectName}
        activeViewName="Level 1 - Plan"
        saveState="saved"
        syncState="synced"
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
      <FileOpenPanel isOpen={fileOpenPanelOpen} onOpenChange={setFileOpenPanelOpen} />
      <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
        <ToolRail
          toolsByCategory={TOOLS_BY_CATEGORY}
          state={toolRailState}
          onToggleCategory={(category) =>
            setToolRailState((state) => toggleCategory(state, category))
          }
          onSelectTool={handleSelectTool}
        />
        <ModelPanel
          tree={MODEL_TREE}
          selection={modelSelection}
          onSelectNode={(nodeId) => setModelSelection({ primary: nodeId, secondary: new Set() })}
        />
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <PlanCanvas
            onPointerWorldPositionChange={setCursorWorldPosition}
            onViewportPixelsPerUnitChange={setPixelsPerUnit}
          />
        </div>
        <InspectorShell
          groups={isWallSelected ? buildDemoWallInspectorGroups() : buildEmptyInspectorGroups()}
          selectedElementDescription={isWallSelected ? buildDemoWallAccessibleDescription() : null}
        />
        {commandPaletteOpen && (
          // CommandPalette now renders its own full-viewport ArqModalDialog
          // (backdrop, centering, focus trap) internally - a positioning
          // wrapper here would be redundant at best. It was actively wrong:
          // its `transform: translateX(-50%)` created a new containing block,
          // which would have made the dialog's `position: fixed` backdrop
          // size itself to this wrapper instead of the viewport.
          <CommandPalette
            entries={COMMAND_ENTRIES}
            onInvoke={(entry) => {
              recordDemoAction(entry.label);
              setCommandPaletteOpen(false);
            }}
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}
      </div>
      <ContextBar
        activeToolId={toolRailState.activeToolId}
        selectionCount={modelSelection.primary === null ? 0 : 1}
        actions={
          isWallSelected
            ? [{ id: 'delete', label: 'Delete', onActivate: () => recordDemoAction('delete wall') }]
            : []
        }
      />
      <StatusBar
        unitLabel="mm"
        cursorWorldPosition={cursorWorldPosition}
        activeSnapLabel={null}
        selectionCount={modelSelection.primary === null ? 0 : 1}
        currentLevelName="Level 1"
        pixelsPerUnit={pixelsPerUnit}
        modelHealth={{ errorCount: 0, warningCount: 0 }}
        localJournalStateLabel="Journal current"
        syncState="synced"
        supportModeEnabled={false}
      />
      <p
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          fontSize: '0.75em',
          color: 'var(--arq-ui-text-muted)',
        }}
      >
        {historyVersion > 0 ? `${historyVersion} demo action(s) recorded` : null}
      </p>
    </div>
  );
}
