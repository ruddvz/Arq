/**
 * ARQ UI/UX Package 3.0 doc 33 ("Project Workspace Operating Model"): opening a
 * project moves the user into one persistent workspace with six stable layers -
 * project, mode, view, tool, context, canvas. Every type below belongs to
 * exactly one of those layers, and none of them duplicates canonical model
 * state: the workspace describes *where the user is*, never *what the building
 * is*. Semantic geometry lives in @arq/bim-core and mutations go through
 * @arq/operations; this package deliberately has no dependency on either, which
 * is what structurally enforces doc 33's "no layer duplicates canonical model
 * state" rule.
 */

/** Layer 2. Doc 33: modes are lenses over one project, not separate apps. */
export type WorkspaceMode = 'design' | 'document' | 'inspect' | 'review' | 'present';

export const WORKSPACE_MODES: readonly WorkspaceMode[] = [
  'design',
  'document',
  'inspect',
  'review',
  'present',
];

/**
 * Package 3.0 `workspace-responsive.ts`: "Device names are presentation
 * guidance only. Layout selection is content/pointer capability driven." The
 * names below are labels for width/pointer bands, not device detection - see
 * `resolveWorkspacePlatform`.
 */
export type WorkspacePlatform =
  'desktop' | 'compact-desktop' | 'tablet-landscape' | 'tablet-portrait' | 'phone';

/** Layer 3. `workspace-tab-registry.json` > `tabKinds[].kind`. */
export type WorkspaceViewKind =
  | 'project-overview'
  | 'plan'
  | '3d'
  | 'section'
  | 'elevation'
  | 'sheet'
  | 'schedule'
  | 'report'
  | 'issues'
  | 'compare'
  | 'model-health'
  | 'ai-proposal';

/**
 * A tab is a *view instance*, which is why `semanticViewId` is optional and
 * separate from `id`. Two tabs can point at one semantic view (doc 37's
 * "duplicate"), and `workspace-tab-registry.json` > `behaviors.close` requires
 * that closing either one leaves the semantic view untouched. `closeTab` in
 * view-tabs-state.ts is the only place that distinction is enforced in code.
 */
export interface WorkspaceViewTab {
  readonly id: string;
  readonly kind: WorkspaceViewKind;
  readonly semanticViewId?: string;
  readonly title: string;
  readonly pinned: boolean;
  readonly closeable: boolean;
}

export interface WorkspaceSelection {
  readonly primaryId: string | null;
  readonly secondaryIds: ReadonlySet<string>;
}

/**
 * `workspace-state-machines.json` > `invariants[0]`: "Local save and remote
 * sync are separate machines." They are two fields of two disjoint unions here
 * for the same reason top-bar-state.ts keeps SaveState and SyncState apart -
 * a project can be fully saved on disk while sync is offline, and collapsing
 * them into one status enum is how "network failure presents as local data
 * loss" bugs get written.
 */
export type LocalSaveState = 'saved-local' | 'saving-local' | 'local-save-failed';

export type RemoteSyncState =
  'not-configured' | 'offline' | 'queued' | 'syncing' | 'synced' | 'conflict' | 'sync-failed';

export interface SaveSyncState {
  readonly local: LocalSaveState;
  readonly sync: RemoteSyncState;
}

/** `workspace-state-machines.json` > `machines['workspace-open']`. */
export type WorkspaceOpenState =
  | 'project-loading'
  | 'project-ready'
  | 'project-offline-ready'
  | 'project-read-only'
  | 'project-recovery-required'
  | 'project-fatal-error';

/**
 * Doc 33 > "What persists while moving around": mode and view changes preserve
 * project identity, revision, save state, sync state and permissions. Grouping
 * them into one object makes that a type-level fact - `switchMode` and the tab
 * reducers take and return `WorkspaceProjectContext` by reference and have no
 * way to edit it.
 */
export interface WorkspaceProjectContext {
  readonly projectId: string;
  readonly projectName: string;
  readonly documentRevision: string;
  readonly openState: WorkspaceOpenState;
  readonly saveSync: SaveSyncState;
  readonly readOnly: boolean;
}
