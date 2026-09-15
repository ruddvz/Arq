/**
 * Canonical product command/tool authority for the ARQ workspace.
 *
 * This is deliberately product truth, not a command design inventory and not a
 * repository-module inventory. A library can exist without a live product
 * consumer. A registry entry can be fully designed without being executable.
 * Neither fact makes a command user-reachable.
 */

import {
  KEYBOARD_COMMANDS,
  TOOL_CONTRACTS,
  keyboardCommand,
  type ToolContract,
} from './registry';
import { toolGroupsForMode } from './mode-state';
import { WORKSPACE_MODES, type WorkspaceMode } from './workspace-types';

export type ProductReachabilityState =
  | 'user-reachable'
  | 'disabled-intentionally'
  | 'registered-but-not-wired'
  | 'library-only'
  | 'dead-stale'
  | 'duplicate';

export type CommandSurface =
  | 'command-palette'
  | 'tool-rail'
  | 'keyboard'
  | 'top-bar'
  | 'contextual';

export type CommandEffect = 'view-only' | 'project-mutating';

export type PersistenceImplication = 'none' | 'journal-on-commit' | 'project-persistence';

export type ReadOnlyBehaviour = 'allowed' | 'disabled';

export type ShortcutDialect = 'mac' | 'windows' | 'ipad-keyboard' | 'touch-only';

export interface CanonicalShortcut {
  readonly mac: string;
  readonly windows: string;
  readonly ipadKeyboard: string;
  readonly touchOnly: string;
}

export type CommandExecutionTarget =
  | { readonly kind: 'tool'; readonly id: string }
  | { readonly kind: 'view-action'; readonly id: string }
  | { readonly kind: 'host-action'; readonly id: string }
  | { readonly kind: 'semantic-operation'; readonly id: string };

export interface CommandRuntimeContext<Mode extends string = string> {
  readonly mode: Mode;
  readonly readOnly: boolean;
  readonly activeCommandIds?: ReadonlySet<string>;
  readonly capabilities?: ReadonlySet<string>;
  /** Host-owned facts such as canUndo or canCloseActiveTab. */
  readonly facts?: Readonly<Record<string, boolean>>;
}

export interface CanonicalCommandDescriptor<Mode extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly modes: readonly Mode[];
  readonly shortcuts: CanonicalShortcut | null;
  readonly surfaces: readonly CommandSurface[];
  readonly reachability: ProductReachabilityState;
  /** Static reason for a non-reachable product state. */
  readonly disabledReason: string | null;
  /** Context-sensitive refusal. Null means the current context permits it. */
  readonly availability?: (context: CommandRuntimeContext<Mode>) => string | null;
  /** Names the owner of pressed/active state rather than duplicating that state here. */
  readonly activeStateSource: string | null;
  readonly executionTarget: CommandExecutionTarget | null;
  /** Eventual semantic mutation committed by a mutating command/tool, when one exists. */
  readonly semanticOperationId: string | null;
  readonly effect: CommandEffect;
  readonly persistence: PersistenceImplication;
  readonly readOnlyBehaviour: ReadOnlyBehaviour;
  /** Independent evidence. It is never an availability predicate. */
  readonly libraryBacking: boolean;
  readonly capabilityRequirement: string | null;
  readonly evidenceOwner: string;
}

export interface ResolvedCommand<Mode extends string = string> {
  readonly descriptor: CanonicalCommandDescriptor<Mode>;
  readonly available: boolean;
  readonly disabledReason: string | null;
  readonly active: boolean;
}

const NON_REACHABLE_FALLBACK: Readonly<
  Record<Exclude<ProductReachabilityState, 'user-reachable'>, string>
> = {
  'disabled-intentionally': 'This command is intentionally unavailable',
  'registered-but-not-wired': 'This command is registered but has no live product execution path',
  'library-only': 'Implementation exists in the repository but is not wired into the product',
  'dead-stale': 'This command is stale and has no current product owner',
  duplicate: 'This command duplicates another canonical command',
};

export function canonicalShortcutLabel(
  shortcut: CanonicalShortcut | null,
  dialect: ShortcutDialect,
): string | null {
  if (shortcut === null) return null;
  switch (dialect) {
    case 'mac':
      return shortcut.mac;
    case 'windows':
      return shortcut.windows;
    case 'ipad-keyboard':
      return shortcut.ipadKeyboard;
    case 'touch-only':
      return shortcut.touchOnly;
  }
}

/**
 * Resolve product availability from one descriptor and the real runtime
 * context. UI visibility is not permission enforcement. The caller must pass
 * the actual read-only/capability/context facts owned elsewhere.
 */
export function resolveCommand<Mode extends string>(
  descriptor: CanonicalCommandDescriptor<Mode>,
  context: CommandRuntimeContext<Mode>,
): ResolvedCommand<Mode> {
  let disabledReason: string | null = null;

  if (descriptor.reachability !== 'user-reachable') {
    disabledReason = descriptor.disabledReason ?? NON_REACHABLE_FALLBACK[descriptor.reachability];
  } else if (!descriptor.modes.includes(context.mode)) {
    disabledReason = `${descriptor.label} is not available in ${context.mode} mode`;
  } else if (
    descriptor.capabilityRequirement !== null &&
    !(context.capabilities?.has(descriptor.capabilityRequirement) ?? false)
  ) {
    disabledReason = `${descriptor.label} requires ${descriptor.capabilityRequirement}`;
  } else if (context.readOnly && descriptor.readOnlyBehaviour === 'disabled') {
    disabledReason = `${descriptor.label} is unavailable in read-only mode`;
  } else if (descriptor.availability !== undefined) {
    disabledReason = descriptor.availability(context);
  }

  return {
    descriptor,
    available: disabledReason === null,
    disabledReason,
    active: context.activeCommandIds?.has(descriptor.id) ?? false,
  };
}

export interface CommandExecutionAdapters {
  readonly activateTool?: (id: string) => void;
  readonly runViewAction?: (id: string) => void;
  readonly runHostAction?: (id: string) => void;
  readonly runSemanticOperation?: (id: string) => void;
}

export type CommandDispatchResult =
  | { readonly status: 'executed' }
  | { readonly status: 'blocked'; readonly reason: string }
  | { readonly status: 'missing-adapter'; readonly target: CommandExecutionTarget };

export function dispatchResolvedCommand<Mode extends string>(
  resolved: ResolvedCommand<Mode>,
  adapters: CommandExecutionAdapters,
): CommandDispatchResult {
  if (!resolved.available) {
    return {
      status: 'blocked',
      reason: resolved.disabledReason ?? 'Command is unavailable',
    };
  }

  const target = resolved.descriptor.executionTarget;
  if (target === null) {
    return { status: 'blocked', reason: 'Command has no execution target' };
  }

  switch (target.kind) {
    case 'tool':
      if (adapters.activateTool === undefined) return { status: 'missing-adapter', target };
      adapters.activateTool(target.id);
      return { status: 'executed' };
    case 'view-action':
      if (adapters.runViewAction === undefined) return { status: 'missing-adapter', target };
      adapters.runViewAction(target.id);
      return { status: 'executed' };
    case 'host-action':
      if (adapters.runHostAction === undefined) return { status: 'missing-adapter', target };
      adapters.runHostAction(target.id);
      return { status: 'executed' };
    case 'semantic-operation':
      if (adapters.runSemanticOperation === undefined) return { status: 'missing-adapter', target };
      adapters.runSemanticOperation(target.id);
      return { status: 'executed' };
  }
}

export interface DescriptorValidationIssue {
  readonly id: string;
  readonly message: string;
}

/** Structural invariants used by tests and future capability-ledger consumers. */
export function validateCommandDescriptors<Mode extends string>(
  descriptors: readonly CanonicalCommandDescriptor<Mode>[],
): readonly DescriptorValidationIssue[] {
  const issues: DescriptorValidationIssue[] = [];
  const seen = new Set<string>();

  for (const descriptor of descriptors) {
    if (seen.has(descriptor.id)) {
      issues.push({ id: descriptor.id, message: 'duplicate canonical id' });
    }
    seen.add(descriptor.id);

    if (descriptor.reachability !== 'user-reachable' && descriptor.disabledReason === null) {
      issues.push({ id: descriptor.id, message: 'non-reachable command needs an explicit reason' });
    }
    if (descriptor.reachability === 'user-reachable' && descriptor.executionTarget === null) {
      issues.push({ id: descriptor.id, message: 'reachable command needs an execution target' });
    }
    if (
      descriptor.reachability === 'user-reachable' &&
      descriptor.effect === 'project-mutating' &&
      descriptor.semanticOperationId === null
    ) {
      issues.push({ id: descriptor.id, message: 'reachable mutating command needs a semantic operation id' });
    }
    if (
      descriptor.reachability === 'user-reachable' &&
      descriptor.surfaces.includes('keyboard') &&
      descriptor.shortcuts === null
    ) {
      issues.push({ id: descriptor.id, message: 'reachable keyboard command needs shortcuts' });
    }
  }

  return issues;
}

/**
 * Evidence that implementing code exists somewhere in the monorepo.
 * This list is deliberately not an availability list.
 */
export const TOOLS_WITH_REPOSITORY_BACKING: readonly string[] = [
  'select',
  'window-select',
  'crossing-select',
  'selection-filter',
  'wall',
  'door',
  'window',
  'room-boundary',
  'pan',
  'zoom',
  'fit',
];

const REPOSITORY_BACKED = new Set(TOOLS_WITH_REPOSITORY_BACKING);

export function hasRepositoryBacking(toolId: string): boolean {
  return REPOSITORY_BACKED.has(toolId);
}

function modesForTool(tool: ToolContract): readonly WorkspaceMode[] {
  return WORKSPACE_MODES.filter((mode) => toolGroupsForMode(mode).includes(tool.group));
}

function shortcutFor(commandId: string): CanonicalShortcut | null {
  const command = keyboardCommand(commandId);
  if (command === null) return null;
  return {
    mac: command.mac,
    windows: commandId === 'redo' ? 'Ctrl+Shift+Z' : command.windows,
    ipadKeyboard: command.ipadKeyboard,
    touchOnly: command.phone,
  };
}

function requiresFact(fact: string, reason: string) {
  return (context: CommandRuntimeContext<WorkspaceMode>): string | null =>
    context.facts?.[fact] === true ? null : reason;
}

const TOOL_REACHABILITY: Readonly<
  Record<
    string,
    {
      readonly state: ProductReachabilityState;
      readonly reason: string | null;
      readonly surfaces?: readonly CommandSurface[];
    }
  >
> = {
  select: {
    state: 'user-reachable',
    reason: null,
    surfaces: ['tool-rail', 'command-palette', 'keyboard'],
  },
  wall: {
    state: 'user-reachable',
    reason: null,
    surfaces: ['tool-rail', 'command-palette', 'keyboard'],
  },
  pan: { state: 'user-reachable', reason: null, surfaces: ['tool-rail'] },
  fit: {
    state: 'user-reachable',
    reason: null,
    surfaces: ['tool-rail', 'command-palette', 'keyboard'],
  },
  door: {
    state: 'library-only',
    reason: 'Door placement has repository backing but no live PlanCanvas execution path',
    surfaces: ['tool-rail', 'command-palette'],
  },
  window: {
    state: 'library-only',
    reason: 'Window placement has repository backing but no live PlanCanvas execution path',
    surfaces: ['tool-rail'],
  },
  'room-boundary': {
    state: 'library-only',
    reason: 'Room boundary placement has repository backing but no live PlanCanvas execution path',
    surfaces: ['tool-rail', 'command-palette'],
  },
  'window-select': {
    state: 'registered-but-not-wired',
    reason: 'Window marquee is implemented under Select; no separate armed Window Select tool is wired',
    surfaces: ['tool-rail'],
  },
  'crossing-select': {
    state: 'registered-but-not-wired',
    reason: 'Crossing marquee is implemented under Select; no separate armed Crossing Select tool is wired',
    surfaces: ['tool-rail'],
  },
  'selection-filter': {
    state: 'registered-but-not-wired',
    reason: 'Selection filter code exists, but no distinct armed Selection Filter tool is wired',
    surfaces: ['tool-rail'],
  },
  zoom: {
    state: 'registered-but-not-wired',
    reason: 'Wheel and pinch zoom are live view gestures; no separate armed Zoom tool is wired',
    surfaces: ['tool-rail'],
  },
};

function toolDescriptor(tool: ToolContract): CanonicalCommandDescriptor<WorkspaceMode> {
  const override = TOOL_REACHABILITY[tool.id];
  const reachability = override?.state ?? 'registered-but-not-wired';
  const userReachable = reachability === 'user-reachable';
  const mutating = tool.id === 'wall' || tool.group === 'Build' || tool.group === 'Modify';
  const semanticOperationId = tool.id === 'wall' ? 'add-walls' : null;

  return {
    id: tool.id,
    label: tool.name,
    category: tool.group,
    modes: modesForTool(tool),
    shortcuts: shortcutFor(tool.id),
    surfaces: override?.surfaces ?? ['tool-rail'],
    reachability,
    disabledReason:
      override?.reason ??
      `${tool.name} is designed in the workspace registry but has no proven live product execution path`,
    activeStateSource: userReachable ? 'workspace.tool-state.activeToolId' : null,
    executionTarget: userReachable ? { kind: 'tool', id: tool.id } : null,
    semanticOperationId,
    effect: mutating ? 'project-mutating' : 'view-only',
    persistence: semanticOperationId === null ? 'none' : 'journal-on-commit',
    readOnlyBehaviour: mutating ? 'disabled' : 'allowed',
    libraryBacking: hasRepositoryBacking(tool.id),
    capabilityRequirement: null,
    evidenceOwner: '#398 reachability audit; #420 canonical authority',
  };
}

const ALL_MODES = WORKSPACE_MODES;

const NON_TOOL_COMMANDS: readonly CanonicalCommandDescriptor<WorkspaceMode>[] = [
  {
    id: 'command-palette',
    label: 'Open command palette',
    category: 'Global',
    modes: ALL_MODES,
    shortcuts: shortcutFor('command-palette'),
    surfaces: ['keyboard', 'top-bar'],
    reachability: 'user-reachable',
    disabledReason: null,
    activeStateSource: null,
    executionTarget: { kind: 'view-action', id: 'open-command-palette' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx command palette wiring',
  },
  {
    id: 'escape',
    label: 'Cancel current tool/draft',
    category: 'Tool',
    modes: ALL_MODES,
    shortcuts: shortcutFor('escape'),
    surfaces: ['keyboard', 'contextual'],
    reachability: 'user-reachable',
    disabledReason: null,
    activeStateSource: null,
    executionTarget: { kind: 'view-action', id: 'cancel-current-tool' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'workspace tool lifecycle and apps/web/src/App.tsx Escape handler',
  },
  {
    id: 'undo',
    label: 'Undo',
    category: 'Edit',
    modes: ALL_MODES,
    shortcuts: shortcutFor('undo'),
    surfaces: ['keyboard', 'top-bar', 'command-palette'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: requiresFact('canUndo', 'Nothing to undo'),
    activeStateSource: null,
    executionTarget: { kind: 'host-action', id: 'undo' },
    semanticOperationId: 'history.undo',
    effect: 'project-mutating',
    persistence: 'journal-on-commit',
    readOnlyBehaviour: 'disabled',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx undo stack and keyboard handler',
  },
  {
    id: 'redo',
    label: 'Redo',
    category: 'Edit',
    modes: ALL_MODES,
    shortcuts: shortcutFor('redo'),
    surfaces: ['keyboard', 'top-bar', 'command-palette'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: requiresFact('canRedo', 'Nothing to redo'),
    activeStateSource: null,
    executionTarget: { kind: 'host-action', id: 'redo' },
    semanticOperationId: 'history.redo',
    effect: 'project-mutating',
    persistence: 'journal-on-commit',
    readOnlyBehaviour: 'disabled',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx undo stack and keyboard handler',
  },
  {
    id: 'close-tab',
    label: 'Close active view',
    category: 'View',
    modes: ALL_MODES,
    shortcuts: shortcutFor('close-tab'),
    surfaces: ['keyboard', 'command-palette', 'contextual'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: requiresFact('canCloseActiveTab', 'The active view cannot be closed'),
    activeStateSource: null,
    executionTarget: { kind: 'view-action', id: 'close-active-tab' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'workspace view-tabs-state and apps/web/src/App.tsx host wiring',
  },
  {
    id: 'open',
    label: 'Open project…',
    category: 'File',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['command-palette', 'top-bar'],
    reachability: 'user-reachable',
    disabledReason: null,
    activeStateSource: null,
    executionTarget: { kind: 'host-action', id: 'open-project' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx file-open panel wiring',
  },
  {
    id: 'save-a-copy',
    label: 'Save a copy',
    category: 'File',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['command-palette'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: requiresFact('canSaveCopy', 'No publishable project copy is available'),
    activeStateSource: null,
    executionTarget: { kind: 'host-action', id: 'save-a-copy' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'disabled',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx handleSaveCopy',
  },
  {
    id: 'export-sheet-pdf',
    label: 'Export sheet as PDF',
    category: 'File',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['command-palette'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: requiresFact('canExportSheetPdf', 'No exportable plan sheet is available'),
    activeStateSource: null,
    executionTarget: { kind: 'host-action', id: 'export-sheet-pdf' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx handleExportSheet',
  },
  {
    id: 'publish',
    label: 'Publish project…',
    category: 'File',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['command-palette', 'top-bar'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: requiresFact('canPublish', 'No writable project is available to publish'),
    activeStateSource: null,
    executionTarget: { kind: 'host-action', id: 'publish' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'project-persistence',
    readOnlyBehaviour: 'disabled',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx handlePublishProject',
  },
  {
    id: 'save',
    label: 'Save local project',
    category: 'File',
    modes: ALL_MODES,
    shortcuts: shortcutFor('save'),
    surfaces: ['keyboard'],
    reachability: 'registered-but-not-wired',
    disabledReason: 'Save is registered in the keyboard design map but has no equivalent live App shortcut handler',
    activeStateSource: null,
    executionTarget: null,
    semanticOperationId: null,
    effect: 'project-mutating',
    persistence: 'project-persistence',
    readOnlyBehaviour: 'disabled',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: '#398 and apps/web/src/App.tsx keyboard handler',
  },
  {
    id: 'focus-selection',
    label: 'Focus selection',
    category: 'View',
    modes: ALL_MODES,
    shortcuts: shortcutFor('focus-selection'),
    surfaces: ['keyboard', 'command-palette'],
    reachability: 'registered-but-not-wired',
    disabledReason: 'Focus Selection is registered but no dedicated product execution path is proven',
    activeStateSource: null,
    executionTarget: null,
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: false,
    capabilityRequirement: null,
    evidenceOwner: '#398 reachability audit',
  },
  {
    id: 'export-dxf',
    label: 'Export DXF',
    category: 'File',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['command-palette'],
    reachability: 'disabled-intentionally',
    disabledReason: 'DXF export is not implemented in the current product',
    activeStateSource: null,
    executionTarget: null,
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: false,
    capabilityRequirement: null,
    evidenceOwner: '#398 placeholder export finding',
  },
  {
    id: 'share',
    label: 'Share',
    category: 'Project',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['top-bar'],
    reachability: 'registered-but-not-wired',
    disabledReason: 'Share currently records a demo action and is not a real product capability',
    activeStateSource: null,
    executionTarget: null,
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: false,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx onShare demo callback',
  },
  {
    id: 'account',
    label: 'Account',
    category: 'Account',
    modes: ALL_MODES,
    shortcuts: null,
    surfaces: ['top-bar'],
    reachability: 'registered-but-not-wired',
    disabledReason: 'Account currently records a demo action and is not a real product capability',
    activeStateSource: null,
    executionTarget: null,
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: false,
    capabilityRequirement: null,
    evidenceOwner: 'apps/web/src/App.tsx onOpenAccountMenu demo callback',
  },
];

/** One canonical product command/tool catalogue. */
export const PRODUCT_COMMANDS: readonly CanonicalCommandDescriptor<WorkspaceMode>[] = [
  ...TOOL_CONTRACTS.map(toolDescriptor),
  ...NON_TOOL_COMMANDS,
];

const COMMANDS_BY_ID = new Map(PRODUCT_COMMANDS.map((command) => [command.id, command]));

export function productCommand(commandId: string): CanonicalCommandDescriptor<WorkspaceMode> | null {
  return COMMANDS_BY_ID.get(commandId) ?? null;
}

export type ProductCommandContext = CommandRuntimeContext<WorkspaceMode>;

export function resolveProductCommand(
  commandId: string,
  context: ProductCommandContext,
): ResolvedCommand<WorkspaceMode> | null {
  const descriptor = productCommand(commandId);
  return descriptor === null ? null : resolveCommand(descriptor, context);
}

export interface ProductSurfaceEntry {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly available: boolean;
  readonly disabledReason: string | null;
  readonly active: boolean;
  readonly shortcutLabel: string | null;
  readonly reachability: ProductReachabilityState;
}

/** One resolver for palette, rail, top-bar and contextual adapters. */
export function productEntriesForSurface(
  surface: CommandSurface,
  context: ProductCommandContext,
  dialect: ShortcutDialect,
): readonly ProductSurfaceEntry[] {
  return PRODUCT_COMMANDS.filter((command) => command.surfaces.includes(surface)).map((command) => {
    const resolved = resolveCommand(command, context);
    return {
      id: command.id,
      label: command.label,
      category: command.category,
      available: resolved.available,
      disabledReason: resolved.disabledReason,
      active: resolved.active,
      shortcutLabel: canonicalShortcutLabel(command.shortcuts, dialect),
      reachability: command.reachability,
    };
  });
}

/** Lookup uses canonical product descriptors, never the design registry alone. */
export function commandForShortcut(
  label: string,
  dialect: ShortcutDialect,
  context: ProductCommandContext,
): ResolvedCommand<WorkspaceMode> | null {
  const normalised = label.trim().toLowerCase();
  for (const command of PRODUCT_COMMANDS) {
    if (!command.surfaces.includes('keyboard')) continue;
    const shortcut = canonicalShortcutLabel(command.shortcuts, dialect);
    if (shortcut === null || shortcut.trim().toLowerCase() !== normalised) continue;
    return resolveCommand(command, context);
  }
  return null;
}

export function dispatchProductCommand(
  commandId: string,
  context: ProductCommandContext,
  adapters: CommandExecutionAdapters,
): CommandDispatchResult {
  const resolved = resolveProductCommand(commandId, context);
  if (resolved === null) return { status: 'blocked', reason: `Unknown command "${commandId}"` };
  return dispatchResolvedCommand(resolved, adapters);
}

/** Designed keyboard entries that are not currently executable keyboard capabilities. */
export function unwiredKeyboardCommandIds(): readonly string[] {
  return KEYBOARD_COMMANDS.map((command) => command.id).filter((id) => {
    const descriptor = productCommand(id);
    return (
      descriptor === null ||
      descriptor.reachability !== 'user-reachable' ||
      !descriptor.surfaces.includes('keyboard')
    );
  });
}
