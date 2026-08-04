# Product copy principles

Canonical standard for ARQ product UI, support and documentation wording.

This file is the merge point of two sources. The short principles below are the
repository's original rules and remain in force. Everything after them is the
ARQ Language System 4.1 product-copy standard, expanded for the 57 specified
ARQ surfaces. Where the two overlap, they agree; where 4.1 is more specific, the
more specific rule applies.

Related canonical material:

- Voice and register: `docs/product/VOICE-SYSTEM.md`
- Machine-readable vocabulary, states, claims and conflicts: `docs/product/voice/`
- Governance and change process: `docs/product/voice/GOVERNANCE.md`
- Editorial review policy: `docs/product/voice/editorial-authenticity-policy.json`

## Core principles

- State the object and action directly.
- Explain failure in plain language.
- Do not hide uncertainty.
- Separate local save from cloud sync.
- Do not claim compatibility beyond tested support.
- Do not describe generated geometry as accurate until calibrated and validated.
- Do not claim code compliance, professional approval or structural safety.
- Avoid generic success messages when the user needs the exact result.

## Error structure

1. What happened
2. Why
3. What was affected
4. What remains safe
5. What the user can do

Example:

> The door overlaps the wall end by 74 mm. Move it inward, reduce its width, or
> extend the wall. No change was applied.

## Labels

Use the shortest unambiguous label.

Good:

- Project browser
- Inspector
- Model health
- Export PDF
- View scale
- Saved locally

Avoid:

- Manage your project
- Project management area
- Your model's current health status

## Tooltips

A tooltip can contain:

1. tool/action name;
2. shortcut;
3. one-line consequence or unavailable reason.

Example:

> **Wall**
> W
> Draw connected wall segments.

Disabled:

> **Export DXF**
> No project open.

Do not use a tooltip to hide a critical warning that belongs in the main workflow.

## Empty states

An empty state should answer:

- what is empty;
- whether this is expected;
- the next meaningful action.

Example:

> **No sheets yet**
> Create a sheet to place views for export.
> **Create sheet**

Avoid invented sample counts, fake activity, fake projects, or demo content that
looks real.

## Loading

Name the thing being loaded when delay is material.

- Opening project
- Rebuilding room boundaries
- Preparing PDF
- Checking import
- Restoring local journal

Do not use "Working..." for long-running professional operations when the user
needs to know which phase is active.

## Completion

Say what completed.

- Exported 1 sheet
- Imported 214 lines with 3 warnings
- Recovered 12 operations
- Saved locally

Avoid:

- Success!
- Done!
- Everything worked

## Permissions

Permission copy states the required access and preserves context. Use the
canonical role names: Owner, Administrator, Editor, Commenter, Viewer.

> You can view this project, but editing requires Editor access.

Do not imply a technical error, and do not use a bare "access denied". Name the
action the reader attempted and the role that permits it. A capability that is
absent from the build is not a permission problem: see "Unavailable
capabilities".

## Offline

Offline is not automatically an error in a local-first product.

Good:

> Offline
> Local editing remains available. Sync will resume when a connection is available.

Avoid:

> Connection lost. Your work may be unavailable.

unless local access really is unavailable.

## Save and sync

Never use one label for both.

Use the canonical state labels from `docs/product/voice/state-language-map.json`.

Local save currently maps to:

- Saving locally...
- Saved locally
- Local save failed

Remote sync maps to:

- Sync not configured
- Offline
- Changes queued for sync
- Syncing...
- Synced
- Sync conflict
- Sync failed

Recovery is a separate state and action. It must not be presented as another
synonym for save.

## Persistence tiers

Local save, local journal, working copy, project file, recovery, migration and
read-only are distinct states. Name the tier that actually changed.

- A journal append is not a portable `.arq` write. Say "Saved locally" or
  "Local changes recorded", never "Project file updated", unless the portable
  file was written.
- A compatibility preflight is not an open project. Say "Compatible ARQ
  project" until a live project session exists.
- A read-only session states why it is read-only and what remains possible.
- A migration states that the original file is preserved and where the migrated
  copy is.

The mapping from a concrete implementation state to the canonical message is
recorded in `docs/product/voice/ui-state-adapter-map.json` and enforced by
`pnpm arq:language:adapters:verify`.

## State exposure

Every state carries an exposure level: `product`, `diagnostic` or `internal`.

Engineering-only conditions must not reach ordinary customer wording unless a
governed translation exists. `local-save-failed`, `reader-too-old-to-write`,
`missing-required-entries` and `safe-mode-required` are diagnostic identifiers,
not user copy. Translate the condition:

> This copy of ARQ is older than the file and can open it read-only. Update ARQ
> to edit it. Your file was not changed.

`docs/product/voice/state-language-map.json` holds the mapping;
`pnpm arq:language:state:verify` fails when a source state has no entry.

## Destructive actions

Name the object in the action.

- Delete wall
- Delete Level 2
- Remove member
- Discard local recovery
- Replace local version

If dependencies are affected, list or count them before enabling the action.

## Form errors

Put the problem next to the field.

Good:

> Wall thickness must be greater than 0 mm.

Avoid:

> Invalid value.

Do not erase an invalid value merely to clear the error. Let the user edit it.

## Command palette

Visible command labels use verbs where useful:

- Draw wall
- Insert door
- Fit view
- Close active view
- Export PDF

The tool rail can keep noun labels:

- Wall
- Door
- Fit

Search synonyms remain invisible unless needed as help text.

## Number and unit formatting

Keep values and units together. Use locale-aware display but canonical internal
values.

Do not write a value without its unit in a sentence when multiple dimensions are
possible.

## Notifications and toasts

Use toasts for transient confirmation, not for critical state.

Good:

> Project name updated.

Bad:

> Export omitted 2 views.

The second needs a persistent export report.

## Import, export and interoperability

Exchange results use the canonical fidelity vocabulary and nothing else:
Preserved, Converted, Approximated, Flattened, Omitted, Unsupported, Retained as
opaque data, Failed.

An adapter or parser is not an import workflow. Describe a tested library as a
library until the product path and its report are tested end to end. Do not
claim a round trip.

## AI proposal language

An AI capability is described as a proposal, never as an action already taken.
A proposal states intent, assumptions, operations, preview and validation, and
undo. AI does not approve, certify or sign off anything.

Do not describe a future contract as a currently shipping capability.

## Information density

Use one sentence for one state, reason or action. Do not add a reassuring second
sentence that repeats the first in broader language. If a user needs an
explanation, name the object, condition and next action.

Do not use conversational filler such as agreement, praise or generic offers of
help in system messages. Product UI states the current condition.

## Unavailable capabilities

Keep a designed control visible when discoverability matters and show the reason.

Use stable reason language:

- No project open
- Not available in this build
- Requires Editor access
- Unavailable while offline
- Resolve blocking errors first
- Planned for Release 2

Avoid:

- Coming soon
- Not possible
- Disabled

## Evidence rules for claim-bearing copy

A current-tense claim needs a source that establishes current, user-reachable
behaviour. Code alone is not enough, and a status note alone is not enough.

- A tool, entity class, library, adapter or code path is not proof of a
  reachable workflow.
- Where authoritative sources disagree, the claim is CONFLICTED. Record it in
  `docs/product/voice/conflict-registry.json` and keep the weaker wording.
  Do not pick the more attractive statement.
- Counts (tests, packages, components) are volatile. Generate them or omit them.
- Privacy, offline behaviour, network behaviour, hardware support, security,
  availability, price, lifetime access, subscription and AI capability claims
  need an authoritative owner. Legal wording is routed to the legal owner.

Claim-bearing public files are bound in
`docs/product/voice/claim-binding-registry.json` and checked by
`pnpm arq:language:claims:verify` and `pnpm arq:language:conflicts:verify`.

## Editorial quality

House style for public and product copy:

- No U+2014 em dash in rendered public or UI text. Use a full stop, comma,
  colon, parentheses, or restructure the sentence. This is a house-style
  decision, not an authorship test.
- No self-attesting trust language ("honest", "genuinely", "not pretending").
  State the behaviour, source or limit instead.
- No combative contrast with unnamed competitors, no fake quotations, no
  invented social proof, no stock conclusions, no formulaic paired emphasis.
- Prefer concrete behaviour to benefit language. Keep sentences proportionate to
  the evidence behind them.
- Vary sentence shape where it helps the reader. Do not apply length or
  punctuation quotas.

`docs/product/voice/editorial-authenticity-policy.json` records which of these
are hard rules and which need a reviewer. The check is a review aid. It is not
an AI-writing detector and must not be described as one.

## Deployed public site

Public copy is only correct once the deployed page is correct.

- The rendered build is checked with `pnpm arq:language:site:build:verify`.
- The deployment writes a commit-bound proof with per-route hashes into the
  artifact.
- The deployed site is checked with `pnpm arq:language:site:live:verify` against
  the published URL and that exact commit.

A source-only pass does not license a claim about the live site.
