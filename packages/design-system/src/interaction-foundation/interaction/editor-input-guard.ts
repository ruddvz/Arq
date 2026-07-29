/**
 * Input-ownership helpers: the one shared answer to "is the user typing?".
 *
 * Before this module existed the same expression was duplicated inline in
 * App.tsx's shortcut handler and PlanCanvas's space-pan tracker; the policy
 * half (Escape-only while typing, IME first) lives in
 * @arq/workspace/keyboard-map's shouldHandleShortcut and stays there. These
 * helpers are the target-classification half both call sites share.
 *
 * Ownership hierarchy (docs 03-CONTEXT-HUD): IME composition, then
 * modal/focus scope, then the active numeric editor, then the active tool,
 * then viewport shortcuts, then application-global shortcuts.
 */

export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * True when a keyboard event should reach editor/viewport shortcut handling:
 * not already claimed, not mid-IME-composition, and not typed into an
 * editable control.
 */
export function shouldRouteShortcutToEditor(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  return !isEditableEventTarget(event.target);
}
