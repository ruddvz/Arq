# CMP-001: Button

## Purpose

Trigger a labelled action.

## Anatomy

- Container
- Label text
- Optional leading icon
- Optional trailing icon
- Accessible name (label text or aria-label)

## Required states

- Default
- Hover
- Focus visible
- Active/pressed
- Disabled with reason
- Loading (label replaced by spinner, width preserved)

## Behaviour

- A destructive action (delete, discard) requires a distinct visual treatment, never colour alone.
- A loading button disables re-submission but keeps its layout width so surrounding content does not reflow.
- Uses the same command availability and permission rules as the action it triggers - a button is never enabled for an action the user cannot perform.
- A disabled button exposes why via `aria-describedby` or an adjacent tooltip, not silently.

## Sizing

- Desktop default height follows the button size tokens (compact/default/large).
- iPad hit target is at least 44x44pt regardless of visual size.
- Label truncates with an accessible full-text fallback (title attribute or tooltip) rather than wrapping.

## Keyboard and accessibility

- Reachable by Tab in document order; activated by Space and Enter.
- Native `<button>` semantics are used wherever the platform allows it, not a `div` with a click handler.
- `aria-busy="true"` while loading; screen readers announce the loading label change.

## Acceptance criteria

- [ ] All required states are implemented and visually distinct without relying on colour alone.
- [ ] Space and Enter both activate the button; loading state cannot be re-triggered.
- [ ] Disabled reason is available to assistive technology, not just sighted users.
- [ ] Contrast and focus-visible outline pass at every state.
