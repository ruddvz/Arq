/**
 * ARQ-152: complete keyboard-only workflow.
 *
 * Blueprint section 29 ("Keyboard baseline") lists the shortcuts a
 * keyboard-only user needs: V/W/D/M/R/O/TR tool keys, Esc/Enter
 * (already reserved unconditionally by keyboard-gesture.ts's own
 * `dispatch`, ARQ-037), Space (temporary pan), Tab (cycle), platform
 * undo/redo, command palette, and fit selection/project. This module
 * is what actually *wires* that list into `createKeyboardShortcutRegistry`
 * (keyboard-gesture.ts) - section 29's own examples were never
 * registered against real command ids anywhere in this codebase before
 * this issue.
 *
 * Deliberately honest about what this repository can back today:
 * `KEYBOARD_BASELINE_COMMAND_IDS` only includes commands with a real
 * implementation elsewhere in this codebase (select: point-selection.ts
 * ARQ-040; wall: wall-draw-tool.ts ARQ-094; door: door-placement-tool.ts
 * ARQ-105; undo/redo: undo-stack.ts ARQ-056/057; fit-selection/
 * fit-project: viewport-controller.ts's fitToBounds, ARQ-033).
 * `KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED` lists section 29 entries with
 * no backing tool yet (Move, Rotate, Offset, Trim, and the command
 * palette itself) - `registerKeyboardBaseline` never binds these,
 * rather than silently registering a shortcut for a command that does
 * not exist, which would make dispatch() report a shortcut succeeded
 * when nothing is actually there to handle it.
 *
 * `door` is bound to `D` per section 29's own worked example - "D Door
 * only if it does not conflict with Dimension" - which is checked here,
 * not assumed: no interactive Dimension tool exists in this codebase
 * yet (dimension-reference.ts/linear-dimension.ts, ARQ-136/137, define
 * the data model only, not an editor-shell tool), so `D` is currently
 * unambiguous. `assertNoDimensionToolConflict` exists so that the day an
 * interactive Dimension tool is added, whoever adds it (or CI, if this
 * function is called from that tool's own test suite) is forced to
 * re-examine this exact keybinding rather than the conflict silently
 * reappearing.
 *
 * Deliberately generic over `commandId` as a plain string, the same
 * domain-agnostic layering every other package in this backlog keeps -
 * this module does not import @arq/editor-shell's tool implementations
 * directly, it only knows the semantic label each key should dispatch.
 *
 * Cross-platform undo/redo/command-palette are bound under both
 * `ctrl+...` and `meta+...`, since `comboKeyFor` (keyboard-gesture.ts)
 * treats Ctrl and Cmd as distinct modifiers and a real cross-platform
 * app must treat them as equivalent for these three shortcuts.
 */

import type { createKeyboardShortcutRegistry } from './keyboard-gesture';

export const KEYBOARD_BASELINE_COMMAND_IDS = {
  select: 'select',
  wall: 'wall',
  door: 'door',
  undo: 'undo',
  redo: 'redo',
  fitSelection: 'fit-selection',
  fitProject: 'fit-project',
} as const;

/** Section 29 baseline entries with no backing implementation in this codebase yet - never registered by registerKeyboardBaseline. */
export const KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED = [
  'move',
  'rotate',
  'offset',
  'trim',
  'command-palette',
] as const;

/**
 * True only while no interactive Dimension tool exists in this
 * codebase - the precondition section 29's own "D Door only if it does
 * not conflict with Dimension" note depends on. Pass the set of
 * registered command ids a caller's own tool registry actually has;
 * this returns false (conflict) if 'dimension' is among them.
 */
export function assertNoDimensionToolConflict(
  registeredToolCommandIds: ReadonlySet<string>,
): boolean {
  return !registeredToolCommandIds.has('dimension');
}

type KeyboardShortcutRegistry = ReturnType<typeof createKeyboardShortcutRegistry>;

/** Registers every section 29 baseline shortcut this codebase can currently back against a real command id. */
export function registerKeyboardBaseline(registry: KeyboardShortcutRegistry): void {
  registry.register('v', KEYBOARD_BASELINE_COMMAND_IDS.select);
  registry.register('w', KEYBOARD_BASELINE_COMMAND_IDS.wall);
  registry.register('d', KEYBOARD_BASELINE_COMMAND_IDS.door);
  registry.register('f', KEYBOARD_BASELINE_COMMAND_IDS.fitSelection);
  registry.register('shift+f', KEYBOARD_BASELINE_COMMAND_IDS.fitProject);

  registry.register('ctrl+z', KEYBOARD_BASELINE_COMMAND_IDS.undo);
  registry.register('meta+z', KEYBOARD_BASELINE_COMMAND_IDS.undo);
  registry.register('ctrl+shift+z', KEYBOARD_BASELINE_COMMAND_IDS.redo);
  registry.register('meta+shift+z', KEYBOARD_BASELINE_COMMAND_IDS.redo);
}
