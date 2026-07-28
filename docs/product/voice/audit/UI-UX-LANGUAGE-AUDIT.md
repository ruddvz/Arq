# UI/UX language audit and fixes

This audit focuses on language as interface behaviour. It does not replace visual, geometry, accessibility, or performance testing.

## 1. One visible name per command

The workspace registry should own the canonical visible tool name. The tool rail, command palette, keyboard shortcut sheet, onboarding, help, telemetry display names, and documentation must not invent parallel labels.

Current example to normalise:

- tool registry: `Wall`
- current command palette: `Wall draw`
- preferred command action label: `Draw wall`

Rule:

- tool rail noun: `Wall`
- command/action verb: `Draw wall`
- search synonyms: `wall`, `draw wall`, legacy shortcut terms if useful

Do not show `Wall draw` as a second product term.

## 2. Status labels are contracts

A status bar is not decoration. Each state must correspond to real underlying state and must not combine independent state machines.

Local persistence and remote sync remain separate:

- Saving locally
- Saved locally
- Local save unavailable
- Unsaved local changes
- Recovered locally

and, separately:

- Sync not configured
- Offline
- Syncing
- Synced
- Sync conflict
- Sync failed

Do not collapse these into `Saved`, `Autosaved`, or `Saved and synced` unless the product can prove exactly which state is being represented.

## 3. Recovery needs provenance

`Recovered` alone is not enough when users need to trust which work returned.

Prefer:

> Recovered 12 local operations from this device.

Then provide a persistent route to inspect the recovery result where consequential.

The recovery surface should distinguish:

- recovered journal;
- original project file;
- migrated working copy;
- last known valid snapshot;
- rejected operations;
- content not recovered.

Never let a recovery success message imply all project data was recovered unless that was verified.

## 4. Import and export are reports, not toast messages

Import should use stable fidelity categories:

- Preserved
- Converted
- Approximated
- Flattened
- Omitted
- Unsupported
- Retained as source data
- Failed

Export should say what was included, omitted, approximated, and failed. A warning that changes issued documentation belongs in a persistent report, not a transient toast.

## 5. Disabled controls explain the blocker

A designed-but-unavailable capability can remain visible when discoverability matters, but its state must be explicit.

Good reasons:

- No project open
- Requires Editor access
- Resolve 2 blocking errors first
- Unavailable while offline
- Not available in this build
- Planned for Release 2

Avoid:

- Disabled
- Unavailable
- Coming soon
- Not possible

Do not claim a release number when the release scope does not commit it.

## 6. Destructive actions name the consequence

Never use `OK`, `Confirm`, or `Continue` as the primary action in a destructive dialog.

Examples:

- Delete wall
- Delete Level 2 and dependent views
- Discard recovered changes
- Replace local copy
- Remove member

When dependencies exist, state the count or list before the action is enabled. Counts must be computed, not invented.

## 7. Validation should keep the failed draft editable

The current validation architecture correctly refuses invalid committed operations. The copy should preserve that mental model:

> Wall is shorter than 1 mm. Move the end point away from the start point. No change was applied.

Do not use copy that suggests Arq silently corrected, rounded, deleted, or substituted geometry.

## 8. Empty states must not fake project activity

The current project overview deliberately omits metrics it cannot answer. Keep this rule across dashboards and future account surfaces.

A new project should not show fake issue counts, fake collaborators, sample revenue-style cards, invented model-health scores, or placeholder project history that looks real.

Explain the next meaningful action instead.

## 9. Current and planned capabilities need visible distinction

The product contains design-specified, capability-gated tools that are not shipping capabilities. Never translate design coverage into a user-facing shipping claim.

Use one of:

- available now;
- available in this build but partial;
- planned for a named release;
- deferred;
- not committed.

Do not use `new`, `available`, or active-looking controls as proxies for roadmap status.

## 10. Offline is a mode, not automatically a failure

For local authoring, offline should describe the remote consequence without alarming users about local work.

Preferred:

> Offline. Local editing remains available. Sync is unavailable until a connection returns.

Only say local editing or project access is unavailable when that is actually true for the current storage state.

## 11. AI proposal UI must use review language

The AI panel should be structured around:

1. Request
2. Interpretation
3. Assumptions
4. Proposed operations
5. Affected objects
6. Document impact
7. Validation
8. Warnings
9. Apply / Reject
10. Provenance and grouped undo after apply

Avoid progress copy such as `Arq is thinking`, `Your AI architect is working`, `Magic fix`, or `I fixed your plan`.

Use `Preparing proposal`, `Validating proposal`, and `Proposal ready`.

## 12. High-risk copy must persist long enough to act on

Persistent surface required for:

- data loss risk;
- migration result;
- recovery result;
- sync conflict;
- import fidelity loss;
- export omissions;
- blocking validation;
- permission changes;
- consequential AI proposal warnings.

Toasts are for low-risk confirmation only.

## 13. Precision copy should not imply precision the system did not establish

A numeric display can be precise in formatting while the source is uncertain. Keep provenance separate from formatting precision.

Examples:

- `2,431 mm` can be a displayed measurement.
- A RoomPlan/LiDAR-derived value must still carry capture provenance and should not be described as a measured survey.
- Imported geometry must not lose its source/fidelity status when displayed in native units.

## 14. Mobile and iPad language should follow interaction, not desktop labels blindly

Desktop terms that refer to physical UI structure should not be copied to a bottom sheet or phone dock when the component has changed form.

Keep conceptual names stable (`Inspector`, `Project browser`, `Views`) while adapting instructions:

- desktop: `Open Inspector`
- tablet: `Show Inspector`
- phone: `Open Inspector sheet`

Avoid documentation that tells touch users to hover, right-click, or press desktop-only shortcuts without an equivalent path.

## 15. Surface specifications need less boilerplate

Many planned page specs repeat the same entry points, regions, states, offline rules, analytics rules, and accessibility text. That makes real surface-specific behaviour harder to see and easier to contradict.

Recommended structural fix:

1. move shared page invariants into one canonical surface baseline;
2. generate or reference the baseline from each page spec;
3. keep only surface-specific state, copy, actions, and exceptions in each page file;
4. add a verifier that every route declares which baseline it inherits and any deliberate override.

This is both a documentation UX fix and a voice-system fix. Repeated prose should not become 57 separate sources of truth.

## 16. Copy order should match the decision order

High-risk messages should begin with the state, not a reassurance or a vague
summary. The reader needs to know what changed before deciding whether to retry,
inspect, recover or stop.

Preferred order:

1. state or result;
2. object/scope;
3. reason/limit;
4. safe boundary;
5. action.

This prevents messages such as "Good news, we saved your work" when the system
only wrote a local journal, or "We are checking a few things" when a project is
read-only because its writer version is newer.

## 17. Variety is not a UI quality metric

Writers may vary marketing prose. Product UI should repeat canonical state and
action names deliberately. `Saved in the local journal` should not alternate
with `Your work is secure`, `Everything is ready` or `All set`. Recognition is
more valuable than stylistic novelty in status, recovery, permission and AI
review surfaces.
