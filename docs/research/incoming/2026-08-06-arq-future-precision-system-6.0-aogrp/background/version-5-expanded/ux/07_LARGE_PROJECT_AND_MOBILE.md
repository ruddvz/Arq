# Large-project, accessibility, and mobile UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Large federated projects and mobile devices require explicit loading, offline, memory, and edit-scope behaviour. Mobile should support meaningful review and bounded edits without pretending to be a full workstation.

## Normative requirements

- The UI MUST show which projects, regions, LODs, and assets are loaded, available offline, stale, missing, or permission-blocked.
- Edit mode MUST identify the authoritative child project and revision. Editing a visual tile or proxy MUST be prevented.
- Memory pressure and storage quota events MUST degrade safely by evicting derived caches before canonical or recovery data.
- Keyboard navigation, screen-reader semantics, focus management, text scaling, contrast, reduced motion, and non-colour status cues are required for core file workflows.
- Mobile review MUST support file preflight, proposal review, comments, selected measurements, and safe publication where platform evidence exists.
- Touch targets and precision input must not rely on pixel-level dragging without numeric entry and snapping support.

## Required invariants

- iOS terminates background worker.
- OPFS quota pressure.
- Gesture changes wrong object.
- LOD pop hides conflict.
- Screen reader cannot reach validation details.

## Known failure modes

- Derived cache eviction never deletes accepted work.
- A proxy is never edited as though it were source geometry.
- Accessibility states carry the same diagnostic truth as visual states.

## Required evidence

- Low-memory device tests.
- Offline reopen tests.
- WCAG-oriented automated and manual checks.
- Mobile Safari publication evidence.
- Large federation navigation benchmarks.

## Implementation guidance

- Design review-first mobile workflows.
- Use explicit numeric controls for precision.
- Expose loaded scope and cache status.
- Allow users to pin required regions for offline use.

## Open decisions

- Supported mobile editing scope and device baseline.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.
