# Repo findings that shaped this voice system

Snapshot: 27 July 2026, default branch `claude/arq-cad-platform-research-ba8rav`.

These are language-system findings, not a full engineering audit.

## High priority

### 1. Current product copy can outrun current product wiring

`apps/marketing/src/content/home.ts` currently says a project is a single `.arq` file that opens in the browser and that saving is a local write. `STATUS.md` says the `.arq` format is library-complete but not yet reachable from the product because there is no open-project pipeline. The current web editor journals a demo project to IndexedDB.

Risk: public present-tense copy can become more confident than the code.

Fix: any "works today" claim must point to code/test evidence or `STATUS.md`, and the claim registry must distinguish CURRENT from PLANNED.

### 2. Some public copy makes lifetime or absolute guarantees

Examples in current public copy include ideas equivalent to:

- stopping payment can never lock a user out;
- drawings will still open if Arq stops existing;
- an Arq outage can never be the user's outage.

The product principle is good: local ownership should reduce lock-in. The wording is stronger than the evidence.

Fix: state the architecture and user control, not an unlimited future guarantee.

Preferred shape:

> Projects are stored as local files. Hosted features must not be required for ordinary local access to a supported project file.

### 3. The public claim test does not catch every risky absolute

`apps/marketing/src/pages.test.ts` blocks affirmative uses of phrases such as full CAD, full BIM, lossless, survey-grade, certified, guaranteed, and zero data loss. That is valuable, but exact-phrase tests do not catch semantically similar claims.

Fix: keep the existing hard gate, add a non-blocking absolute-claim audit, and make reviewers resolve each hit.

### 4. Canonical product-copy principles are too small for the size of the UI

`docs/product/PRODUCT-COPY-PRINCIPLES.md` has eight bullets and a five-part error structure. The route map specifies 57 surfaces, including recovery, sync conflict, import/export reports, diagnostics, model health, and AI proposal.

Fix: expand the canonical standard into state naming, destructive actions, permissions, offline, save/sync, import/export fidelity, recovery, accessibility, AI, tool labels, and current/planned claims.

## Medium priority

### 5. Brand-name capitalisation is not fully settled in prose

The repository uses both `ARQ` and `Arq`. Brand assets are named `ARQ_*`; the blueprint and public marketing mostly use `Arq`.

Decision in this package:

- **Arq** in running prose and UI.
- **ARQ** only when reproducing the wordmark, a formal document/file identifier, or an all-caps asset name.
- **`.arq`** for the file extension.

### 6. Public tone sometimes becomes combative

Examples include language equivalent to "CAD marketing usually lies", "that would be a lie", and comparisons with what "most pre-release products" do.

This is memorable, but it shifts Arq from calm professional instrument to competitor commentary.

Fix: make honesty visible through specificity, not accusation.

### 7. AI marketing is more metaphorical than the underlying product contract

The AI page uses "careful junior", "red pen", and "ghost hand". The actual product contract is stronger and clearer: intent, assumptions, typed operations, preview, validation, approval, provenance, grouped undo.

Fix: use the contract as the main voice. Metaphor may appear once in marketing, never in the AI proposal UI.

### 8. Volatile implementation counts appear in public copy

The product page includes an exact test count. Other pages refer to several hundred tests and a fixed number of tested viewports.

Fix: public exact counts must be generated or CI-guarded. Otherwise say "tested in CI" and link to evidence.

### 9. Hardware capability wording needs evidence boundaries

The student page says a modest laptop is enough. That is broader than the benchmark evidence described in the blueprint.

Fix: name tested minimums when they exist. Until then, say the browser build is being benchmarked across supported environments.

### 10. Universal interoperability statements should be scoped

"Nothing round-trips perfectly between BIM tools" is a universal claim. The real product principle is better: do not assume lossless exchange, and report preserved, converted, flattened, omitted, or unsupported content.

Fix: state Arq's behaviour, not a universal law about all BIM tools.

## UI and UX copy opportunities

### Disabled controls

The current product correctly keeps unavailable controls visible and gives a reason. Standardise reasons into stable categories:

- Not available in this build
- No project open
- Requires editor access
- Unavailable while offline
- Resolve blocking model errors first
- Available in a later release

Do not use "Coming soon" inside professional workflow UI.

### Save and sync

Keep these separate everywhere.

Recommended local states:

- Not opened
- Saving locally
- Saved locally
- Recovered locally
- Local save unavailable
- Unsaved local changes

Recommended sync states:

- Sync not configured
- Offline
- Syncing
- Synced
- Sync paused
- Sync conflict
- Sync failed

Never collapse them into one cloud icon with one ambiguous label.

### Validation

Existing validation messages already follow the right structure. Keep:

1. what happened;
2. why;
3. affected objects;
4. what remains safe;
5. actions.

Remove internal IDs from the primary sentence unless the user has diagnostics open.

### Import/export

Never say only "Import successful" or "Export complete" when fidelity matters.

Show:

- imported/included;
- converted;
- approximated;
- omitted;
- unsupported;
- failed;
- warnings;
- where the output went.

### Recovery

"Recovered" must say what was recovered and from where. Do not imply the portable `.arq` file was repaired when only the local journal was replayed.

## Spec quality issue worth fixing outside voice work

Several `docs/pages/PROJ-*` specifications appear to share generic entry-point and required-region boilerplate even when the surface is a panel, report, or recovery page. The boilerplate is useful as a baseline, but it can encode incorrect UX if treated literally.

Recommendation: split the shared requirements into a canonical page-contract include or generator, then keep only surface-specific differences in each page spec.
