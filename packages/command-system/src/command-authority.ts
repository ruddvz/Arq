/**
 * Product-facing command authority primitives.
 *
 * A descriptor answers what the product can actually execute, not what code or
 * design inventory happens to exist somewhere in the repository. Repository
 * backing is evidence only. It never makes a command available by itself.
 */

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

export type PersistenceImplication =
  | 'none'
  | 'journal-on-commit'
  | 'project-persistence';

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
  /** Optional context-sensitive refusal. Null means the context permits it. */
  readonly availability?: (context: CommandRuntimeContext<Mode>) => string | null;
  /** Identifies the state source used to render pressed/active UI. */
  readonly activeStateSource: string | null;
  readonly executionTarget: CommandExecutionTarget | null;
  /** The semantic operation ultimately committed by a mutating command/tool. */
  readonly semanticOperationId: string | null;
  readonly effect: CommandEffect;
  readonly persistence: PersistenceImplication;
  readonly readOnlyBehaviour: ReadOnlyBehaviour;
  /** Independent from reachability. Code can exist while this stays unavailable. */
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

export function shortcutLabel(
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
  } else if (
    context.readOnly &&
    descriptor.effect === 'project-mutating' &&
    descriptor.readOnlyBehaviour === 'disabled'
  ) {
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

/**
 * Dispatch only a resolved, currently available command. Visibility is never
 * used as permission enforcement; callers must supply the real runtime context.
 */
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
      if (adapters.runSemanticOperation === undefined) {
        return { status: 'missing-adapter', target };
      }
      adapters.runSemanticOperation(target.id);
      return { status: 'executed' };
  }
}

export interface DescriptorValidationIssue {
  readonly id: string;
  readonly message: string;
}

/** Deterministic structural checks shared by catalog tests and future tooling. */
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
      descriptor.surfaces.includes('keyboard') &&
      descriptor.reachability === 'user-reachable' &&
      descriptor.shortcuts === null
    ) {
      issues.push({ id: descriptor.id, message: 'reachable keyboard command needs shortcuts' });
    }
  }

  return issues;
}
