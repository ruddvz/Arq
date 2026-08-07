# First vertical slice

Build an experimental pack for one small architectural project containing levels, walls, openings, rooms, a plan view, dimensions, one sheet, operation history, and one asset.

Acceptance:

- Same semantic root from Rust and TypeScript or Python independent readers.
- Source SQLite fixture remains unchanged.
- Conversion report lists every entity and field.
- Pack opens without SQLite.
- Interrupted append before new recovery root reopens the prior revision.
- One corrupt recovery root falls back to the other.
- Both corrupt roots fail safely.
- Unknown required capability opens preserving read-only or blocks according to profile.
- Repack produces different file bytes but identical semantic root.
- Product UI is not changed in this slice.
