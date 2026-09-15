import { describe, expect, it } from 'vitest';
import { TOOL_CONTRACTS, toolContract } from './registry';
import {
  INITIAL_TOOL_STATE,
  TOOLS_WITH_REPOSITORY_BACKING,
  activateTool,
  beginCommit,
  beginPreview,
  cancelTool,
  hasRepositoryBacking,
  isToolAvailable,
  resolveCommit,
  toolCoverage,
  toolRailEntriesForMode,
  toolUnavailableReason,
} from './tool-state';

describe('TOOLS_WITH_REPOSITORY_BACKING', () => {
  it('only names tools the registry defines', () => {
    for (const id of TOOLS_WITH_REPOSITORY_BACKING) {
      expect(toolContract(id), `unknown tool id "${id}"`).not.toBeNull();
    }
  });

  it('is a strict subset of what the registry calls existing-or-partial', () => {
    const existingOrPartial = TOOL_CONTRACTS.filter((t) => t.status === 'existing-or-partial');
    expect(TOOLS_WITH_REPOSITORY_BACKING.length).toBeLessThan(existingOrPartial.length);
  });

  it('does not claim the dimension tool, which has an icon but no module', () => {
    expect(toolContract('dimension')).not.toBeNull();
    expect(hasRepositoryBacking('dimension')).toBe(false);
  });
});

describe('toolUnavailableReason', () => {
  it('names an unknown tool rather than silently disabling it', () => {
    expect(toolUnavailableReason('teleport', 'design')).toBe('Unknown tool "teleport"');
  });

  it('explains a mode mismatch', () => {
    expect(toolUnavailableReason('wall', 'review')).toBe('Wall is not available in review mode');
  });

  it('keeps designed-only tools unavailable with a product reason', () => {
    expect(toolUnavailableReason('stair', 'design')).toContain('no proven live product execution path');
  });

  it('allows only tools with a live product consumer', () => {
    expect(toolUnavailableReason('wall', 'design')).toBeNull();
    expect(isToolAvailable('pan', 'present')).toBe(true);
    expect(isToolAvailable('fit', 'design')).toBe(true);
  });

  it('does not turn repository backing into availability', () => {
    expect(hasRepositoryBacking('door')).toBe(true);
    expect(isToolAvailable('door', 'design')).toBe(false);
    expect(toolUnavailableReason('door', 'design')).toContain('no live PlanCanvas execution path');

    expect(hasRepositoryBacking('zoom')).toBe(true);
    expect(isToolAvailable('zoom', 'present')).toBe(false);
    expect(toolUnavailableReason('zoom', 'present')).toContain('no separate armed Zoom tool');
  });

  it('enforces read-only behaviour independently of visibility', () => {
    expect(isToolAvailable('wall', 'design', true)).toBe(false);
    expect(toolUnavailableReason('wall', 'design', true)).toBe('Wall is unavailable in read-only mode');
    expect(isToolAvailable('pan', 'present', true)).toBe(true);
  });
});

describe('activateTool', () => {
  it('arms the tool without moving past armed', () => {
    const state = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    expect(state.activeToolId).toBe('wall');
    expect(state.phase).toBe('armed');
  });

  it('refuses unavailable, context-blocked and library-only tools', () => {
    expect(activateTool(INITIAL_TOOL_STATE, 'stair', 'design')).toBe(INITIAL_TOOL_STATE);
    expect(activateTool(INITIAL_TOOL_STATE, 'door', 'design')).toBe(INITIAL_TOOL_STATE);
    expect(activateTool(INITIAL_TOOL_STATE, 'wall', 'review')).toBe(INITIAL_TOOL_STATE);
    expect(activateTool(INITIAL_TOOL_STATE, 'wall', 'design', true)).toBe(INITIAL_TOOL_STATE);
  });
});

describe('tool phase machine', () => {
  it('runs the happy path arm -> preview -> commit -> complete', () => {
    let state = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    state = beginPreview(state);
    expect(state.phase).toBe('previewing');
    state = beginCommit(state);
    expect(state.phase).toBe('committing');
    expect(resolveCommit(state, true).phase).toBe('complete');
  });

  it('lands a refused commit in rejected, not back in armed', () => {
    const state = beginCommit(beginPreview(activateTool(INITIAL_TOOL_STATE, 'wall', 'design')));
    expect(resolveCommit(state, false).phase).toBe('rejected');
  });

  it('ignores out-of-order transitions', () => {
    expect(beginCommit(INITIAL_TOOL_STATE)).toBe(INITIAL_TOOL_STATE);
    expect(beginPreview(INITIAL_TOOL_STATE)).toBe(INITIAL_TOOL_STATE);
    expect(resolveCommit(INITIAL_TOOL_STATE, true)).toBe(INITIAL_TOOL_STATE);
  });
});

describe('cancelTool', () => {
  it('cancels the draft first, then falls back to the persistent tool', () => {
    let state = beginPreview(activateTool(INITIAL_TOOL_STATE, 'wall', 'design'));
    state = cancelTool(state);
    expect(state.phase).toBe('cancelled');
    expect(state.activeToolId).toBe('wall');

    state = cancelTool(state);
    expect(state.phase).toBe('armed');
    expect(state.activeToolId).toBe('wall');

    state = cancelTool(state);
    expect(state.activeToolId).toBe('select');
  });

  it('does nothing from inactive', () => {
    expect(cancelTool(INITIAL_TOOL_STATE)).toBe(INITIAL_TOOL_STATE);
  });
});

describe('toolRailEntriesForMode', () => {
  it('keeps unavailable tools visible with the canonical reason', () => {
    const entries = toolRailEntriesForMode('design');
    const stair = entries.find((entry) => entry.tool.id === 'stair');
    const door = entries.find((entry) => entry.tool.id === 'door');
    expect(stair?.available).toBe(false);
    expect(stair?.disabledReason).toBeTruthy();
    expect(door?.available).toBe(false);
    expect(door?.disabledReason).toContain('no live PlanCanvas execution path');
  });

  it('lists only the groups the mode carries', () => {
    const groups = new Set(toolRailEntriesForMode('present').map((entry) => entry.tool.group));
    expect([...groups]).toEqual(['View']);
  });

  it('gives every entry either availability or a reason, never neither', () => {
    for (const entry of toolRailEntriesForMode('design')) {
      expect(entry.available === (entry.disabledReason === null)).toBe(true);
    }
  });
});

describe('toolCoverage', () => {
  it('reports repository backing separately from product reachability', () => {
    const coverage = toolCoverage();
    expect(coverage.registryTotal).toBe(54);
    expect(coverage.repositoryBacked).toBe(TOOLS_WITH_REPOSITORY_BACKING.length);
    expect(coverage.repositoryBacked + coverage.designSpecifiedOnly).toBe(coverage.registryTotal);
    expect(coverage.repositoryBacked).toBeLessThan(coverage.registryTotal);
  });
});
