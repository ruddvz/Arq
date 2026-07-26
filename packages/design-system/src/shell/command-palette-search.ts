/**
 * ARQ-029: build command palette shell.
 *
 * Blueprint section 30 ("Command palette") requirements this module
 * implements: "fuzzy search" (subsequence matching, not just substring -
 * typing "wldr" matches "Wall draw"), "synonyms" (an entry's optional
 * `synonyms` are searched the same as its label), "result category"
 * (`CommandPaletteEntry.category` is carried through unchanged so a caller
 * can group/label results), "disabled reason" (`disabledReason` is data on
 * the entry, not computed here - this module only searches/ranks, it does
 * not know why a command might be unavailable).
 *
 * Non-goals, left to the caller/a later issue: "recent commands" (this
 * module has no persistence - a caller passes recently-used entries first
 * if it wants that ordering when the query is empty), "no-result telemetry"
 * (an analytics concern, out of scope for a pure search function), and "AI
 * actions later" (literally deferred by the blueprint's own bullet).
 */

export interface CommandPaletteEntry {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly synonyms?: readonly string[];
  readonly disabledReason?: string;
  /**
   * Platform-adapted shortcut label, e.g. `⌘K` or `Ctrl+K`, from
   * `shortcutLabel` in @arq/workspace. The palette is where a user *discovers*
   * shortcuts, so showing the binding beside the command is how they graduate
   * from searching to typing it - `workspace-keyboard-map.json`'s own rule is
   * that labels are "platform-adapted, not hard-coded Cmd everywhere", so this
   * is passed in already resolved rather than derived here.
   */
  readonly shortcutLabel?: string;
}

export interface CommandPaletteMatch {
  readonly entry: CommandPaletteEntry;
  /** Lower is a better match (fewer/tighter-packed matched characters) - used only to rank, not shown to the user. */
  readonly score: number;
}

/**
 * Subsequence fuzzy match: every character of `query` (case-insensitive)
 * must appear in `target` in order, not necessarily contiguous. Returns
 * null for no match, or a score rewarding tighter, earlier matches (a
 * smaller total gap between matched characters, and an earlier start)
 * so "wall" ranks "Wall draw" above "Sidewalk allowance" for the query
 * "wall".
 */
function fuzzyMatchScore(query: string, target: string): number | null {
  if (query.length === 0) {
    return 0;
  }
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let queryIndex = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;
  for (let targetIndex = 0; targetIndex < t.length && queryIndex < q.length; targetIndex += 1) {
    if (t[targetIndex] === q[queryIndex]) {
      if (firstMatchIndex === -1) {
        firstMatchIndex = targetIndex;
      }
      lastMatchIndex = targetIndex;
      queryIndex += 1;
    }
  }
  if (queryIndex < q.length) {
    return null;
  }
  const span = lastMatchIndex - firstMatchIndex + 1;
  return span + firstMatchIndex;
}

function bestScoreForEntry(query: string, entry: CommandPaletteEntry): number | null {
  const candidates = [entry.label, ...(entry.synonyms ?? [])];
  let best: number | null = null;
  for (const candidate of candidates) {
    const score = fuzzyMatchScore(query, candidate);
    if (score !== null && (best === null || score < best)) {
      best = score;
    }
  }
  return best;
}

/**
 * Ranks `entries` against `query` (empty query returns every entry, in
 * input order - the caller's "recent commands" ordering, per this module's
 * own non-goal above). Stable-sorts by score ascending, preserving input
 * order between equal scores.
 */
export function searchCommandPaletteEntries(
  entries: readonly CommandPaletteEntry[],
  query: string,
): readonly CommandPaletteMatch[] {
  const matches: CommandPaletteMatch[] = [];
  entries.forEach((entry) => {
    const score = bestScoreForEntry(query, entry);
    if (score !== null) {
      matches.push({ entry, score });
    }
  });
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => a.match.score - b.match.score || a.index - b.index)
    .map(({ match }) => match);
}
