import {
  dispatchResolvedCommand,
  resolveCommand,
  shortcutLabel as canonicalShortcutLabel,
  type CanonicalCommandDescriptor,
  type CanonicalShortcut,
  type CommandDispatchResult,
  type CommandExecutionAdapters,
  type CommandRuntimeContext,
  type CommandSurface,
  type ResolvedCommand,
  type ShortcutDialect,
} from '@arq/command-system';
import {
  KEYBOARD_COMMANDS,
  TOOL_CONTRACTS,
  keyboardCommand,
  type ToolContract,
} from './registry';
import { toolGroupsForMode } from './mode-state';
import { WORKSPACE_MODES, type WorkspaceMode } from './workspace-types';

/**
 * Evidence that implementing code exists somewhere in the monorepo.
 *
 * This is deliberately not an availability list. #398 proved that only a
 * subset of these IDs have a live product consumer.
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
    // Live App handling is Ctrl/Cmd+Shift+Z. Ctrl+Y is not handled.
    windows: commandId === 'redo' ? 'Ctrl+Shift+Z' : command.windows,
    ipadKeyboard: command.ipadKeyboard,
    touchOnly: command.phone,
  };
}

const TOOL_REACHABILITY: Readonly<
  Record<
    string,
    {
      readonly state: CanonicalCommandDescriptor<WorkspaceMode>['reachability'];
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
  const isMutatingTool = tool.id === 'wall' || tool.group === 'Build' || tool.group === 'Modify';
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
    effect: isMutatingTool ? 'project-mutating' : 'view-only',
    persistence: semanticOperationId === null ? 'none' : 'journal-on-commit',
    readOnlyBehaviour: isMutatingTool ? 'disabled' : 'allowed',
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
    id: 'undo',
    label: 'Undo',
    category: 'Edit',
    modes: ALL_MODES,
    shortcuts: shortcutFor('undo'),
    surfaces: ['keyboard', 'top-bar', 'command-palette'],
    reachability: 'user-reachable',
    disabledReason: null,
    availability: (context) => context.facts?.canUndo === false ? 'Nothing to undo' : null,
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
    availability: (context) => context.facts?.canRedo === false ? 'Nothing to redo' : null,
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
    availability: (context) =>
      context.facts?.canCloseActiveTab === false ? 'The active view cannot be closed' : null,
    activeStateSource: null,
    executionTarget: { kind: 'view-action', id: 'close-active-tab' },
    semanticOperationId: null,
    effect: 'view-only',
    persistence: 'none',
    readOnlyBehaviour: 'allowed',
    libraryBacking: true,
    capabilityRequirement: null,
    evidenceOwner: 'workspace view-tabs-state and App host wiring',
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

/** The one product capability truth consumed by workspace command surfaces. */
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
  readonly reachability: CanonicalCommandDescriptor<WorkspaceMode>['reachability'];
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

/** Lookup uses only the canonical product descriptors, never the design registry alone. */
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

/**
 * Design keyboard entries remain useful as inventory. This reports which ones
 * are not currently executable keyboard capabilities so callers do not confuse
 * registry presence with a shipping shortcut.
 */
export function unwiredKeyboardCommandIds(): readonly string[] {
  return KEYBOARD_COMMANDS.map((command) => command.id).filter((id) => {
    const descriptor = productCommand(id);
    return descriptor === null ||
      descriptor.reachability !== 'user-reachable' ||
      !descriptor.surfaces.includes('keyboard');
  });
}
