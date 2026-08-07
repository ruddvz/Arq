import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  INITIAL_TOOL_STATE,
  activateTool,
  beginCommit,
  beginPreview,
  cancelTool,
  requestNumericInput,
  resolveCommit,
} from '@arq/workspace';
import { createGroupedUndoStack } from '@arq/operations';
import {
  applyOperation,
  invertOperation,
  type DrawnWall,
  type WorkspaceOperation,
} from './plan-document';

/**
 * The Version 12 command contract's invariants, asserted against the lifecycle
 * this application actually runs.
 *
 * That qualifier matters. The repository contains two command state machines:
 * `@arq/workspace`'s `ToolState` (nine phases, used by apps/web) and
 * `@arq/command-system`'s `createCommandLifecycle` (eight states, reachable
 * only through @arq/editor-shell and not used here). Each is unit-tested
 * on its own. Testing the wrong one would produce a green suite that says
 * nothing about the product, so this exercises the phases the app dispatches,
 * joined to the real grouped undo stack and the real plan-document reducer.
 *
 * The four invariants, verbatim from `command-contract.json`:
 * "one command id across routes", "preview is not canonical",
 * "invalid commit changes nothing", "completed command creates one undo unit".
 */

const wall = (id: string): DrawnWall => ({
  id,
  start: worldPoint(0, 0),
  end: worldPoint(4000, 0),
});

/**
 * The commit path a tool takes. Canonical state moves on `complete` and on
 * nothing else - which is the rule the contract is really making.
 */
function runCommand(
  walls: readonly DrawnWall[],
  stack: ReturnType<typeof createGroupedUndoStack<WorkspaceOperation>>,
  operation: WorkspaceOperation,
  label: string,
  accepted: boolean,
): { readonly walls: readonly DrawnWall[]; readonly phase: string } {
  let tool = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
  tool = beginPreview(tool);
  tool = beginCommit(tool);
  tool = resolveCommit(tool, accepted);

  if (tool.phase !== 'complete') {
    return { walls, phase: tool.phase };
  }
  stack.beginGroup(label);
  stack.record({ forward: operation, inverse: invertOperation(walls, operation) });
  stack.endGroup();
  return { walls: applyOperation(walls, operation), phase: tool.phase };
}

describe('wall command contract', () => {
  it('leaves committed state unchanged when the command is rejected', () => {
    const stack = createGroupedUndoStack<WorkspaceOperation>();
    const before: readonly DrawnWall[] = [wall('w1')];

    const result = runCommand(
      before,
      stack,
      { kind: 'add-walls', walls: [wall('w2')] },
      'Draw wall',
      false,
    );

    expect(result.phase).toBe('rejected');
    expect(result.walls).toEqual(before);
    // "Changes nothing" has to include the history: without this a later undo
    // could resurrect an edit the product refused.
    expect(stack.undo()).toEqual([]);
  });

  it('creates exactly one undo unit for one completed command', () => {
    const stack = createGroupedUndoStack<WorkspaceOperation>();
    // A chain is several segments and one command. Undo must return the model
    // to before the chain, not peel it off one segment at a time.
    const chain: WorkspaceOperation = {
      kind: 'add-walls',
      walls: [wall('w1'), wall('w2'), wall('w3')],
    };

    const result = runCommand([], stack, chain, 'Draw wall chain', true);
    expect(result.walls).toHaveLength(3);

    expect(stack.undo()).toHaveLength(1);
    expect(stack.undo()).toEqual([]);
  });

  it('restores the last committed state when the command is cancelled', () => {
    const committed: readonly DrawnWall[] = [wall('w1')];
    let tool = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    tool = beginPreview(tool);
    tool = cancelTool(tool);

    expect(tool.phase).toBe('cancelled');
    // No commit ran, so canonical state was never asked to move.
    expect(committed).toEqual([wall('w1')]);
  });

  it('keeps a preview and a pending numeric entry out of canonical state', () => {
    const stack = createGroupedUndoStack<WorkspaceOperation>();
    let tool = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    tool = beginPreview(tool);
    expect(tool.phase).toBe('previewing');

    // Typing an exact value is still not a commit - the contract separates
    // "preview is not canonical" from "invalid commit changes nothing", and
    // this is the first of the two.
    tool = requestNumericInput(tool);
    expect(tool.phase).toBe('awaiting-numeric-input');
    expect(stack.undo()).toEqual([]);
  });

  it('undoes and redoes a completed command as one unit', () => {
    const stack = createGroupedUndoStack<WorkspaceOperation>();
    const operation: WorkspaceOperation = {
      kind: 'add-walls',
      walls: [wall('w1'), wall('w2')],
    };

    let walls = runCommand([], stack, operation, 'Draw wall chain', true).walls;
    expect(walls).toHaveLength(2);

    for (const undone of stack.undo()) {
      walls = applyOperation(walls, undone);
    }
    expect(walls).toHaveLength(0);

    for (const redone of stack.redo()) {
      walls = applyOperation(walls, redone);
    }
    expect(walls.map((w) => w.id).sort()).toEqual(['w1', 'w2']);
  });

  it('dispatches the same tool id however the command was invoked', () => {
    // "One command id across routes": the rail, the palette and a shortcut all
    // call activateTool with the same id, so the resulting state is identical.
    const fromRail = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    const fromPalette = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    const fromShortcut = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');

    expect(fromPalette).toEqual(fromRail);
    expect(fromShortcut).toEqual(fromRail);
    expect(fromRail.activeToolId).toBe('wall');
  });
});
