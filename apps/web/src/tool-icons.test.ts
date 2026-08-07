import { describe, expect, it } from 'vitest';
import { TOOL_CONTRACTS } from '@arq/workspace';
import { TOOL_ICONS, TOOLS_AWAITING_ICON } from './tool-icons';

const REGISTRY_TOOL_IDS = TOOL_CONTRACTS.map((tool) => tool.id);

describe('tool icon coverage', () => {
  it('accounts for every registry tool exactly once', () => {
    // The rule worth enforcing is not "every tool has an icon" - 24 do not, and
    // pretending otherwise would mean inventing artwork. It is that no tool is
    // silently unaccounted for: a tool added without a glyph and without being
    // listed fails here rather than quietly rendering a bare label.
    const drawn = new Set(Object.keys(TOOL_ICONS));
    const awaiting = new Set(TOOLS_AWAITING_ICON);

    const unaccounted = REGISTRY_TOOL_IDS.filter((id) => !drawn.has(id) && !awaiting.has(id));

    expect(unaccounted).toEqual([]);
  });

  it('never lists a tool as awaiting artwork that already has some', () => {
    // Makes the list shrink monotonically: landing a glyph without removing the
    // entry fails, so the backlog cannot quietly overstate itself.
    const stale = TOOLS_AWAITING_ICON.filter((id) => id in TOOL_ICONS);

    expect(stale).toEqual([]);
  });

  it('maps no icon to a tool the registry does not have', () => {
    // Catches the rename: a tool id changed in the registry leaves a dead entry
    // here, and the rail silently loses the glyph it used to show.
    const registry = new Set(REGISTRY_TOOL_IDS);
    const orphaned = Object.keys(TOOL_ICONS).filter((id) => !registry.has(id));

    expect(orphaned).toEqual([]);
  });

  it('draws every tool the repository has artwork for', () => {
    // The coverage figure, pinned. If it moves in either direction someone has
    // either added artwork (update the list) or dropped it (a regression).
    //
    // 54, and `TOOLS_AWAITING_ICON` is now empty: every tool the registry
    // declares has an ARQ glyph. It was 30, with 24 tools showing their label
    // and nothing else.
    expect(Object.keys(TOOL_ICONS)).toHaveLength(54);
    expect(REGISTRY_TOOL_IDS).toHaveLength(54);
  });
});
