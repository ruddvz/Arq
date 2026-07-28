# Empty, loading, offline, stale, and partial states

These states are part of the product, not filler.

## Empty

An empty state explains why the area is empty and names the next valid action.

Good:

> No sheets yet. Create a sheet to place a plan view for export.

Do not invent sample data, fake counts, fake project metrics, or fake activity to make the interface look populated.

## Loading

Name the object or task:

- Opening project…
- Loading Level 1 plan…
- Checking project file…
- Generating preview…

Avoid a lone “Loading…” when the object is known.

## Offline

Offline is not inherently degraded in a local-first workflow.

Good:

> Offline · project available locally

Bad:

> Connection lost. Your work may be unavailable.

unless the local project really is unavailable.

## Stale

State what changed:

> Model health results are from an earlier project revision. Recheck the model.

Do not show stale derived information as current merely because it is still renderable.

## Partial

Partial result copy must split:

- completed;
- incomplete;
- preserved;
- next action.

Example:

> PDF export completed with omissions. 4 sheets were exported; 1 sheet was skipped because its viewport has blocking errors.
