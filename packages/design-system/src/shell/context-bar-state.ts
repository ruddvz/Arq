/**
 * ARQ-028: build context bar.
 *
 * Blueprint section 12 > "Context bar": "appears for the active tool or
 * selection" and "disappears after tool exit." `isContextBarVisible` is that
 * one rule, factored out so it can be tested without a component: the bar shows
 * when there is an active tool or a non-empty selection, and hides the moment
 * both are gone (idle Select tool, nothing selected) - it does not linger.
 *
 * It also hides when it has no actions to carry, which is the part the tool and
 * selection alone cannot answer. An opened project arrives with the Select tool
 * active and nothing selected, which satisfied the tool clause and left a
 * seventeen-pixel empty toolbar inside a thirty-eight-pixel slot across the
 * bottom of the drawing - a strip taken from the model to show nothing. The bar
 * renders "the most likely immediate controls" and nothing else, so with no
 * controls there is nothing for it to be.
 */
export function isContextBarVisible(
  activeToolId: string | null,
  selectionCount: number,
  actionCount: number,
): boolean {
  if (actionCount <= 0) {
    return false;
  }
  return activeToolId !== null || selectionCount > 0;
}
