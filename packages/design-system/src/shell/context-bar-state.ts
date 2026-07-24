/**
 * ARQ-028: build context bar.
 *
 * Blueprint section 12 > "Context bar": "appears for the active tool or
 * selection" and "disappears after tool exit." `isContextBarVisible` is
 * that one rule, factored out so it can be tested without a component: the
 * bar shows when there is an active tool or a non-empty selection, and
 * hides the moment both are gone (idle Select tool, nothing selected) -
 * it does not linger.
 */
export function isContextBarVisible(activeToolId: string | null, selectionCount: number): boolean {
  return activeToolId !== null || selectionCount > 0;
}
