# Change propagation protocol 2.0

A change is not complete until the canonical source, generated context, dependent copy, support vocabulary, future AI context, and tests agree.

## Mandatory sequence

1. Change the actual canonical source.
2. Change working implementation/tests when applicable.
3. Refresh generated repo context.
4. Inspect the machine-generated change-impact report.
5. Update visible UI copy.
6. Update docs/help.
7. Update public copy if claim state changed.
8. Update support aliases/answers if user diagnosis changed.
9. Update future AI context/guardrails if its contract changed.
10. Update changelog/status where relevant.
11. Run language audit and full affected tests.

## Change classes

### Tool/command rename

Source:
`workspace-tool-registry.json` or keyboard/command registry.

Must search:

- tool rail;
- command palette;
- tooltips;
- shortcut list;
- onboarding;
- help/docs;
- accessibility labels;
- aliases;
- support intents;
- screenshots/captions.

Old name may remain only as a search/support alias when useful.

### State-machine change

Source:
workspace/state machine or `.arq` file flow.

Must update:

- `state-language-map.json`;
- status bar/top bar;
- empty/error/recovery screens;
- support diagnostics;
- tests for exhaustive mapping.

A new internal state without user-language mapping is a build failure.

### Role/permission change

Source:
RBAC.

Must update:

- disabled-control reasons;
- share/member settings;
- destructive-action eligibility;
- support answers;
- docs prerequisites.

### Format-support change

Source:
adapter reachability + format matrix.

Must update:

- import/export UI;
- format-language map;
- interoperability marketing;
- support compatibility answer;
- claim registry;
- tests.

### Release-scope change

Source:
ADR/release scope/blueprint.

Must update:

- claim registry;
- website roadmap;
- gated controls;
- support answer state;
- future AI context;
- page specs.

### Current capability becomes reachable

Source:
code + tests first.

Then:

- capability evidence;
- `STATUS.md`;
- generated fact snapshot;
- UI copy;
- public “today” copy;
- support answer;
- changelog.

Never promote marketing first.

### `.arq` format/schema/open change

Source:
ADR/schema/open/migration/recovery code.

Must update:

- file-state mapping;
- migration copy;
- recovery copy;
- diagnostics;
- support;
- docs;
- security/local-first claims if the invariant changes.

### AI boundary change

Source:
AI ADR/guardrails/operation-validation design.

Must update:

- AI proposal UI;
- claim registry;
- marketing AI;
- support AI;
- future AI system contract;
- safety/permission tests.

## Generated context freshness

`03-machine-layer/refresh-repo-context.mjs` creates a source-hash snapshot after integration.

CI must fail if:

- a tracked source changed;
- the generated snapshot was not refreshed;
- a canonical mapping no longer covers a state/name.

## Pull-request language impact

Every PR touching a tracked source should answer:

- Which canonical domain changed?
- Did user-visible meaning change?
- Did claim state change?
- Did any canonical visible name change?
- Did permission or destructive scope change?
- Did file/recovery safety language change?
- Did support diagnosis change?
- Did AI context change?
- What automated guard prevents stale copy?
