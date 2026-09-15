import {
  emptySelection,
  extendSelection,
  replaceSelection,
  toggleSelection,
} from './selection-state';
import type { WorkspaceSelection } from './workspace-types';

/**
 * Surface-neutral semantic selection intent.
 *
 * Plan, 3D, tree and other input surfaces may translate their own pointer,
 * keyboard or marquee gestures into one of these intents. They must not encode
 * separate membership rules after this boundary.
 */
export type SelectionIntent =
  | { readonly kind: 'clear' }
  | { readonly kind: 'replace'; readonly ids: readonly string[] }
  | { readonly kind: 'extend'; readonly ids: readonly string[] }
  | { readonly kind: 'toggle'; readonly ids: readonly string[] };

/**
 * Applies a surface-neutral intent using the canonical pure transitions.
 * Toggle-many is processed in explicit input order so promotion remains stable
 * and independently testable; this function does not infer geometry ordering.
 */
export function applySelectionIntent(
  selection: WorkspaceSelection,
  intent: SelectionIntent,
): WorkspaceSelection {
  switch (intent.kind) {
    case 'clear':
      return emptySelection();
    case 'replace':
      return replaceSelection(intent.ids);
    case 'extend':
      return extendSelection(selection, intent.ids);
    case 'toggle': {
      let next = selection;
      for (const id of intent.ids) {
        next = toggleSelection(next, id);
      }
      return next;
    }
  }
}
