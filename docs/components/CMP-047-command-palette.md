# CMP-047: Command palette

## Purpose

Search actions and objects.

## Anatomy

- Search input
- Filtered, ranked list of matching commands/objects
- Optional keyboard-shortcut hints per result (CMP-048)

## Required states

- Closed
- Open, empty query (recent/suggested commands)
- Open, typing (filtered results)
- No results
- Result focused

## Behaviour

- Ranks results by relevance to the typed query, not just alphabetically or by insertion order.
- Never executes a command silently on typing - only on explicit selection (Enter or click), so a fast typist never accidentally fires something destructive mid-query.
- A command unavailable in the current context (e.g. no permission, or requires a selection that does not exist) still appears but is shown disabled with a stated reason, so users can discover what exists.

## Sizing

- Modal-style overlay sized to a fixed maximum width/height regardless of viewport, centred, with internal scrolling for long result lists.

## Keyboard and accessibility

- A documented global shortcut (e.g. Cmd/Ctrl+K) opens it from anywhere in the application.
- Arrow Up/Down moves the highlighted result; Enter executes it; Escape closes without executing anything.

## Acceptance criteria

- [ ] Global shortcut opens it from any screen/mode.
- [ ] Nothing executes until explicit selection - typing alone never triggers a command.
- [ ] Unavailable commands are discoverable (shown, disabled, with a reason), not hidden.
