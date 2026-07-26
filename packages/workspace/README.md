# @arq/workspace

The open-project workspace contract: modes, view tabs, panel docking, the tool
taxonomy, capability gates and responsive layout selection.

Pure TypeScript. No React, no DOM, no dependency on `@arq/bim-core` or
`@arq/operations` — that absence is deliberate and load-bearing. UI/UX Package
3.0 doc 33 requires that "no layer duplicates canonical model state"; a package
that cannot reach the model cannot mirror it, and a tab close has no channel
through which to become a deletion.

## Contents

| Module                  | What it owns                                              |
| ----------------------- | --------------------------------------------------------- |
| `registry.ts`           | Typed access to the checked-in Package 3.0/4.0 registries |
| `workspace-types.ts`    | Project context, modes, tabs, save/sync state             |
| `responsive.ts`         | Platform band and layout slot selection, canvas floor     |
| `view-tabs-state.ts`    | Open, close, pin, reorder, duplicate, overflow            |
| `panel-layout-state.ts` | Dock / collapse / float, registry width bounds            |
| `mode-state.ts`         | Mode switching and availability reasons                   |
| `tool-state.ts`         | Tool lifecycle and the repository-backing ledger          |
| `capability-gates.ts`   | Feature gating, off by default                            |
| `project-overview.ts`   | Dashboard card selection from real data only              |
| `keyboard-map.ts`       | Platform-adapted shortcut labels, IME and field rules     |

## Registries

`src/registry/` holds the 13 `workspace-*.json` files from the package,
verbatim. They are the implementation contract, not documentation:
`registry.test.ts` fails the build when the JSON and the TypeScript disagree,
and `scripts/check-workspace-registries.mjs` checks structural integrity across
all 13 — including the three large design inventories (icons, components,
surfaces) that no runtime module imports.

Only the small, runtime-relevant registries are imported by code. The icon,
component and surface registries total roughly 280 KB of specification text and
would bloat the application bundle to no purpose, so the validation script reads
those from disk instead.

## Status honesty

`TOOLS_WITH_REPOSITORY_BACKING` in `tool-state.ts` is the list of tools this
repository can actually perform, each entry annotated with its implementing
module. It is much shorter than the registry's own `existing-or-partial` set,
and a test asserts it stays that way. The registry's status field is a _design_
coverage marker; this list is a _code_ fact, and the workspace UI acts on the
second.

Likewise `DEFAULT_WORKSPACE_CAPABILITIES` starts every gate off except
`CAP-core-plan`. See `docs/design/WORKSPACE-3.0-INTEGRATION.md` for the full
designed-versus-built ledger.
