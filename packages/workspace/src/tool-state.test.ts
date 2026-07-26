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

  /**
   * The distinction doc 38 insists on: registry status is a design-coverage
   * marker, repository backing is whether code here does the work. If these two
   * ever became the same set, this package would be making a shipping claim on
   * the registry's behalf.
   */
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

  it('says designed-but-not-built for registry tools with no module here', () => {
    expect(toolUnavailableReason('stair', 'design')).toBe('Stair is designed but not built yet');
  });

  it('allows a backed tool in a mode that carries its group', () => {
    expect(toolUnavailableReason('wall', 'design')).toBeNull();
    expect(isToolAvailable('pan', 'present')).toBe(true);
  });
});

describe('activateTool', () => {
  it('arms the tool without moving past armed', () => {
    const state = activateTool(INITIAL_TOOL_STATE, 'wall', 'design');
    expect(state.activeToolId).toBe('wall');
    expect(state.phase).toBe('armed');
  });

  it('refuses an unavailable tool', () => {
    expect(activateTool(INITIAL_TOOL_STATE, 'stair', 'design')).toBe(INITIAL_TOOL_STATE);
    expect(activateTool(INITIAL_TOOL_STATE, 'wall', 'review')).toBe(INITIAL_TOOL_STATE);
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
  /**
   * Registry: "Escape returns to Select or previous persistent tool according
   * to tool contract." First Escape abandons the draft, second leaves the tool.
   */
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
  it('keeps unbuilt tools visible with a reason instead of hiding them', () => {
    const entries = toolRailEntriesForMode('design');
    const stair = entries.find((entry) => entry.tool.id === 'stair');
    expect(stair).toBeDefined();
    expect(stair?.available).toBe(false);
    expect(stair?.disabledReason).toBeTruthy();
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
  it('reports the registry total and the smaller backed count', () => {
    const coverage = toolCoverage();
    expect(coverage.registryTotal).toBe(54);
    expect(coverage.repositoryBacked).toBe(TOOLS_WITH_REPOSITORY_BACKING.length);
    expect(coverage.repositoryBacked + coverage.designSpecifiedOnly).toBe(coverage.registryTotal);
    expect(coverage.repositoryBacked).toBeLessThan(coverage.registryTotal);
  });
});
