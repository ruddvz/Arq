/**
 * Typed access to the ARQ UI/UX Package 3.0/4.0 workspace registries under
 * `src/registry/`. Those JSON files are the package's machine-readable
 * implementation contract, copied in verbatim (only re-indented) so that the
 * repository has one checked-in source of truth rather than a prose paraphrase
 * that drifts. `scripts/check-workspace-registries.mjs` is the gate that keeps
 * this module and those files agreeing.
 *
 * Only the registries this package actually reasons about at runtime are
 * imported here. `workspace-icon-registry.json` (215 entries),
 * `workspace-component-registry.json` (147) and `workspace-surface-registry.json`
 * (30) are design inventories, not runtime data: importing them would push
 * ~280 KB of specification text into the application bundle to no purpose. The
 * validation script reads those three from disk instead.
 */

import capabilityGatesJson from './registry/workspace-capability-gates.json';
import keyboardMapJson from './registry/workspace-keyboard-map.json';
import layoutSlotsJson from './registry/workspace-layout-slots.json';
import panelRegistryJson from './registry/workspace-panel-registry.json';
import platformLayoutsJson from './registry/workspace-platform-layouts.json';
import stateMachinesJson from './registry/workspace-state-machines.json';
import tabRegistryJson from './registry/workspace-tab-registry.json';
import toolRegistryJson from './registry/workspace-tool-registry.json';

import type { WorkspaceViewKind } from './workspace-types';

/** `workspace-tab-registry.json` > `tabKinds[]`. */
export interface TabKindContract {
  readonly kind: WorkspaceViewKind;
  readonly label: string;
  readonly icon: string;
  readonly closeable: boolean;
  readonly duplicable: boolean;
  readonly supportsPin: boolean;
  readonly supportsSplit: boolean;
  readonly notes: readonly string[];
}

/**
 * `workspace-tool-registry.json` > `tools[]`. The registry's own
 * `important` note reads: "Status is a design/implementation coverage marker,
 * not a shipping claim." `'design-specified-capability-gated'` therefore means
 * *the design is finished*, not *the tool works* - `isToolImplemented` is the
 * only place code is allowed to act on that distinction.
 */
export type ToolStatus = 'existing-or-partial' | 'design-specified-capability-gated';

export type ToolGroup =
  'Select' | 'Draw' | 'Build' | 'Modify' | 'Annotate' | 'Measure' | 'View' | 'Review';

export interface ToolContract {
  readonly id: string;
  readonly name: string;
  readonly group: ToolGroup;
  readonly icon: string;
  readonly status: ToolStatus;
  readonly activation: string;
  readonly cancel: string;
  readonly touch: string;
  readonly keyboard: string;
}

/** `workspace-panel-registry.json` > `panels[]`. */
export interface PanelDesktopContract {
  readonly defaultWidth: number;
  readonly min?: number;
  readonly max?: number;
  readonly dock: string;
}

export interface PanelContract {
  readonly id: string;
  readonly name: string;
  readonly desktop: PanelDesktopContract;
  readonly tabs: readonly string[];
  readonly phone: string;
  readonly tablet?: string;
}

/**
 * `workspace-layout-slots.json` > `layouts[key]`.
 *
 * Only `topBar` is common to all eight layouts, so everything else is optional
 * - and the optionality is meaningful rather than defensive. The phone and
 * Android layouts carry `viewTabBar` instead of `tabStrip` because doc 34 says
 * "on phone, tabs become a compact current-view control plus a full-height View
 * Switcher": a phone genuinely has no tab strip, and a contract that pretended
 * otherwise would invite exactly the desktop-squeezed-onto-a-phone layout doc
 * 46 forbids. Likewise the touch layouts have no `canvasMinWidth` because their
 * panels are drawers and sheets that never take width from the canvas.
 */
export interface LayoutSlotContract {
  readonly viewport?: string;
  readonly topBar: number;
  /** Desktop and tablet: the full view-tab strip. */
  readonly tabStrip?: number;
  /** Phone and Android: the compact current-view control. */
  readonly viewTabBar?: number;
  readonly modeRail?: number;
  readonly toolRail?: number;
  readonly leftPanel?: number | 'overlay';
  readonly rightPanel?: number | 'overlay';
  readonly contextBar?: number;
  readonly statusBar?: number;
  readonly statusMinimal?: number;
  readonly canvasMinWidth?: number;
  readonly bottomDock?: number;
  readonly sheetDetents?: readonly number[];
  readonly floatingToolPalette?: number;
  readonly inspectorDrawer?: number;
  readonly toolCategoryStrip?: number;
  readonly numericDock?: number;
  readonly contextNumericDock?: number;
  readonly bottomInspectorDetents?: readonly number[];
  readonly safeInset?: number;
  readonly rule?: string;
  readonly notes?: readonly string[];
  readonly collapsePriority?: readonly string[];
}

/**
 * The height of whichever view-switching control the layout has. Callers that
 * only need "how tall is the thing above the canvas" should use this rather
 * than reaching for `tabStrip` and getting `undefined` on a phone.
 */
export function viewSwitcherHeightPx(slots: LayoutSlotContract): number {
  return slots.tabStrip ?? slots.viewTabBar ?? 0;
}

/** `workspace-keyboard-map.json` > `commands[]`. */
export interface KeyboardCommandContract {
  readonly id: string;
  readonly label: string;
  readonly mac: string;
  readonly windows: string;
  readonly ipadKeyboard: string;
  readonly phone: string;
  readonly scope: string;
}

/** `workspace-capability-gates.json` > `gates[]`. */
export interface CapabilityGateContract {
  readonly id: string;
  readonly status: string;
  readonly surfaces: readonly string[];
  readonly rule: string;
}

export const TAB_KIND_CONTRACTS: readonly TabKindContract[] =
  tabRegistryJson.tabKinds as readonly TabKindContract[];

export const TAB_BEHAVIOURS: Readonly<Record<string, string>> = tabRegistryJson.behaviors;

export const TOOL_CONTRACTS: readonly ToolContract[] =
  toolRegistryJson.tools as readonly ToolContract[];

export const TOOL_GROUPS: readonly ToolGroup[] =
  toolRegistryJson.toolGroups as readonly ToolGroup[];

export const PANEL_CONTRACTS: readonly PanelContract[] =
  panelRegistryJson.panels as readonly PanelContract[];

export const LAYOUT_SLOTS: Readonly<Record<string, LayoutSlotContract>> =
  layoutSlotsJson.layouts as Readonly<Record<string, LayoutSlotContract>>;

export const KEYBOARD_COMMANDS: readonly KeyboardCommandContract[] =
  keyboardMapJson.commands as readonly KeyboardCommandContract[];

export const KEYBOARD_RULES: readonly string[] = keyboardMapJson.rules;

export const CAPABILITY_GATES: readonly CapabilityGateContract[] =
  capabilityGatesJson.gates as readonly CapabilityGateContract[];

export const PLATFORM_CONTRACTS: Readonly<Record<string, unknown>> = platformLayoutsJson.platforms;

export const WORKSPACE_STATE_MACHINES: Readonly<Record<string, readonly string[]>> =
  stateMachinesJson.machines;

export const WORKSPACE_INVARIANTS: readonly string[] = stateMachinesJson.invariants;

const TOOLS_BY_ID = new Map<string, ToolContract>(TOOL_CONTRACTS.map((tool) => [tool.id, tool]));

const PANELS_BY_ID = new Map<string, PanelContract>(
  PANEL_CONTRACTS.map((panel) => [panel.id, panel]),
);

export function tabKindContract(kind: WorkspaceViewKind): TabKindContract | null {
  return TAB_KIND_CONTRACTS.find((contract) => contract.kind === kind) ?? null;
}

export function toolContract(toolId: string): ToolContract | null {
  return TOOLS_BY_ID.get(toolId) ?? null;
}

export function panelContract(panelId: string): PanelContract | null {
  return PANELS_BY_ID.get(panelId) ?? null;
}

export function toolsInGroup(group: ToolGroup): readonly ToolContract[] {
  return TOOL_CONTRACTS.filter((tool) => tool.group === group);
}

export function layoutSlots(layoutId: string): LayoutSlotContract | null {
  return LAYOUT_SLOTS[layoutId] ?? null;
}

export function keyboardCommand(commandId: string): KeyboardCommandContract | null {
  return KEYBOARD_COMMANDS.find((command) => command.id === commandId) ?? null;
}

export function capabilityGate(gateId: string): CapabilityGateContract | null {
  return CAPABILITY_GATES.find((gate) => gate.id === gateId) ?? null;
}
