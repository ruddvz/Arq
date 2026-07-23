/**
 * ARQ-170: ai: prototype one-step wall edit proposal.
 *
 * Blueprint section 100's Feature 2 ("Bounded modification") names this
 * exact example: "Change the selected walls to 150 mm." Section 101's
 * "AI proposal panel" lists what must be shown: original request, parsed
 * intent, assumptions, exact elements, exact operations, before and
 * after values, warnings, preview, Apply, Edit request, Reject. This
 * module builds the structured data half of that panel - `Apply`/`Edit
 * request`/`Reject` are UI actions on this data, out of scope for a
 * data-layer prototype.
 *
 * No natural-language/intent-extraction layer exists in this repository
 * (ARQ-168's benchmark write-up already established this) - `targets`
 * and `newHeightMm` are the ALREADY-parsed intent a caller supplies
 * (what a real intent-extraction step would have produced from "change
 * the selected walls to 150mm"), not text this module parses itself.
 * `originalRequest` is recorded verbatim for section 101's "original
 * request" display field only - never inspected or parsed.
 *
 * Deliberately reuses @arq/arqscript's own AST rather than inventing a
 * parallel "proposal operation" shape: one `UpdateWallCommand`
 * (arqscript-command.ts, ARQ-166) per selected wall, assembled into one
 * `ArqScriptDocument` (ARQ-166) sharing one `scriptId` - the same
 * grouped-undo key every other ArqScript document uses, so "grouped
 * undo" is visible for free rather than reinvented here.
 *
 * `assumptions` (from `collectAssumptions`) is real, not fabricated: a
 * bounded height-only edit gives every command an explicit height, so it
 * is genuinely always empty for this proposal shape - there is nothing
 * this constructor filled in by default. `warnings` is always empty too,
 * honestly, not silently: no semantic or geometry validation is wired to
 * this prototype (that infrastructure - opening-overlap-validation.ts,
 * geometry conflict checks - belongs to a later step that actually
 * commits an operation against real project state, which this data-layer
 * prototype does not have access to).
 */

import { createUpdateWallCommand } from './arqscript-command';
import {
  createArqScriptDocument,
  collectAssumptions,
  type ArqScriptDocument,
} from './arqscript-document';

export interface WallEditTarget {
  readonly wallId: string;
  readonly currentHeightMm: number;
}

export interface WallHeightChange {
  readonly wallId: string;
  readonly beforeMm: number;
  readonly afterMm: number;
}

export interface WallHeightEditProposal {
  readonly originalRequest: string;
  readonly parsedIntent: string;
  readonly scriptId: string;
  /** Exact operations (section 101): one UpdateWall command per target, all sharing `scriptId`. */
  readonly document: ArqScriptDocument;
  /** Before and after values (section 101), one row per target wall. */
  readonly changes: readonly WallHeightChange[];
  readonly assumptions: readonly string[];
  /** Always empty in this prototype - no semantic/geometry validation is wired in yet; see module doc comment. */
  readonly warnings: readonly string[];
}

/** Builds a one-step "change these walls' height" proposal. Rejects an empty target list - there is nothing to propose for no selection. */
export function proposeWallHeightEdit(
  originalRequest: string,
  targets: readonly WallEditTarget[],
  newHeightMm: number,
  scriptId: string,
): WallHeightEditProposal {
  if (targets.length === 0) {
    throw new RangeError('proposeWallHeightEdit requires at least one selected wall');
  }

  const commands = targets.map((target) =>
    createUpdateWallCommand({ id: target.wallId, heightMm: newHeightMm }),
  );
  const document = createArqScriptDocument({ version: '0.1', scriptId, commands });

  const changes: WallHeightChange[] = targets.map((target) => ({
    wallId: target.wallId,
    beforeMm: target.currentHeightMm,
    afterMm: newHeightMm,
  }));

  const wallList = targets.map((target) => target.wallId).join(', ');
  const parsedIntent = `Update height to ${newHeightMm}mm for wall${targets.length === 1 ? '' : 's'} ${wallList}`;

  return {
    originalRequest,
    parsedIntent,
    scriptId,
    document,
    changes,
    assumptions: collectAssumptions(document),
    warnings: [],
  };
}
