# ADR-0027: Desktop shell strategy — browser first, Tauri deferred

**Status:** Accepted (deferral; revisit gates below)
**Date:** 2026-07-26

## Decision

Arq ships as a browser application. No Tauri (or other native desktop shell)
package, toolchain, or build target is added to this repository now.

This records the repository decision that
`packages/workspace/src/registry/workspace-capability-gates.json` ("Do not add
Tauri/native mobile packaging from this UI package alone") and
`workspace-platform-layouts.json` ("does not authorize Tauri/native
iPad/iPhone/Android implementation without repository decision") already point
to, so the question stops being re-litigated each time an external planning
pack proposes a shell.

Revisit only when at least one of these gates is met with evidence:

1. A required file, menu, window, or packaging capability that OPFS, the File
   System Access API, and PWA installation cannot provide on a supported
   platform.
2. Measured WebView/browser performance or capability parity failure for an
   approved product requirement, with the profile attached.
3. A distribution requirement (signed installers, enterprise deployment, app
   store) confirmed by the product owner.

If a gate passes, adoption still follows its own proposal: pinned Tauri/Rust
versions, least-privilege capability declarations per native command, a
browser-equivalent fallback for every shell feature behind a small capability
port (the same seam as `native-desktop-port.ts` in the 2026-07-24 research
pack), signed-build QA on each supported OS, and no `macOSPrivateApi` in the
default distributable. A native (non-WebView) renderer remains a separate
decision that a shell adoption does not imply.

## Reason

Everything shipped here is 2D-plan-first browser work (ADR-0001), persistence
is built on browser storage (SQLite WASM + OPFS, ADR-0019/0024), and the only
native-platform ADR is iPad strategy (ADR-0015). A desktop shell today would
add a Rust packaging toolchain, a capability/security review surface, and a
second distribution pipeline while the browser product it would wrap is still
being built. The 2026-07-24 research pack's own deep dive reaches the same
ordering: ship and test the browser renderer first, wrap it only when desktop
requirements justify it, and never treat Tauri as an implied renderer change.

## Consequences

- External proposals to add a desktop shell are answered by this ADR until a
  gate is met; sessions should not re-raise the question without gate
  evidence.
- The web app must keep working with no native port present — the capability
  seam stays optional by construction.
- Registered in `docs/product/DECISION-REGISTER.csv` as D-024.
