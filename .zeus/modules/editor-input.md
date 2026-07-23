# Editor and input module

Command lifecycle: preview, Escape cancels, Enter commits only a valid preview. Keep screen and world coordinates structurally distinct. Snap results carry source, priority, screen distance and constraints. No hover-only action; mouse, keyboard, touch and Pencil each have explicit, tested behaviour. Selection order and tie-breaks are deterministic. Every meaningful command is undoable or explicitly non-reversible.
