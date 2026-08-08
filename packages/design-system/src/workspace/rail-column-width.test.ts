import { describe, expect, it } from 'vitest';
import { MODE_RAIL_WIDTH_PX } from './mode-rail';
import { TOOL_RAIL_DOCK_WIDTH_PX } from '../shell/tool-rail';
import { WORKSPACE_RAILS_DOCK_WIDTH_PX } from './workspace-root';

/**
 * When the tool rail is a dock it is stacked directly beneath the mode rail
 * inside one card, and `workspace-shell.css` states what that card is meant to
 * be: "the reference gives the edge a single 56px column".
 *
 * The two widths are declared in different packages' worth of layering -
 * `shell/` may not import `workspace/` - so nothing in the type system holds
 * them together. They drifted once already: the dock width stayed at the 48px
 * chosen for a rail that used to stand on its own, and after the rails were
 * stacked that left the tool rail's card 8px narrower than the mode rail's
 * inside the same dock, with its glyphs centred 4.5px off the mode rail's axis.
 *
 * This is the thing that noticed. It fails on the number, not on a screenshot,
 * so the next person to change either constant is told immediately rather than
 * finding out from a plan that looks subtly crooked.
 */
describe('the docked rails are one column', () => {
  it('gives the mode rail and the docked tool rail the same width', () => {
    expect(TOOL_RAIL_DOCK_WIDTH_PX).toBe(MODE_RAIL_WIDTH_PX);
  });

  it('reports that width as the pair’s width, with neither rail overhanging', () => {
    expect(WORKSPACE_RAILS_DOCK_WIDTH_PX).toBe(MODE_RAIL_WIDTH_PX);
    expect(WORKSPACE_RAILS_DOCK_WIDTH_PX).toBe(TOOL_RAIL_DOCK_WIDTH_PX);
  });
});
