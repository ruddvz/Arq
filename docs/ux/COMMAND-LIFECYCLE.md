# Command lifecycle

States:

1. Idle
2. Armed
3. Previewing
4. Awaiting input
5. Validating
6. Committed
7. Failed safely
8. Cancelled

Every tool exposes the state visually and to accessibility APIs.

Escape clears field, cancels segment, then exits tool. Enter commits only a valid
preview. Invalid operations leave project state unchanged.
