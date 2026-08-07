---
source_id: ARQ-OS3-PROTECTED-WORKFLOW
source_type: product-and-release-control
class: C
status: active-bridge
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ product owner
repository_authority: docs/product/RELEASE-SCOPE.md and accepted ADRs
---

# Product scope and protected workflow

## Source boundary

This file does not redefine ARQ product scope. It protects the active release slice while directing agents to current repository product and release sources.

## Protected first vertical slice

The target sequence remains:

1. Create a project.
2. Author a dimensioned residential plan with semantic walls, openings, and rooms.
3. View a coordinated 3D representation derived from the same model.
4. Place dimensions and content on a sheet.
5. Export a scaled vector PDF with an explicit fidelity result.
6. Close, recover, reopen, and continue without losing acknowledged work.
7. Reject invalid operations without changing accepted canonical state.

This sequence is a release acceptance target. Each step must be marked separately as Proposed, Accepted, Implemented, Verified, Released, Blocked, or Unknown.

## Current evidence boundary at the observed snapshot

Implemented and verified pieces exist, including wall authoring, a local browser journal, a 3D viewing surface, tested libraries, and `.arq` file-format code. The complete protected sequence is not verified because project open, reachable import/export, portable save, and the full authoring-to-PDF-to-reopen path remain incomplete or disconnected.

## Scope lock

Do not expand into broad collaboration, cloud sync, native desktop, full iPhone authoring, structural or MEP claims, broad AI authoring, complete IFC or DXF interchange, or enterprise administration before the protected slice passes its evidence gates or an accepted decision changes priority.

## Acceptance record required per step

Each step needs:

- repository SHA;
- fixture and starting state;
- exact user procedure;
- automated test IDs and commands;
- runtime evidence;
- expected and actual state transitions;
- failure and cancellation evidence;
- saved artifact and hash where applicable;
- platform and browser;
- verifier and date;
- limitations;
- regression status;
- release or deployment identifier if published.

## UX changes required by current gaps

### Project-open flow

The file verdict cannot be the end of the flow. The UI needs explicit stages for selected bytes, compatibility, completeness risk, migration copy, working-copy creation, open success, read-only fallback, quarantine, cancellation, and repair guidance.

### Save-state language

The product must distinguish browser journal, working copy, portable `.arq` publication, recovery snapshot, sync state, and exported copy. A local journal state must never be labelled as a saved portable project file.

### 3D state

The reachable 3D surface is a viewer with shared selection. Do not present 3D authoring controls or a released-3D claim until the corresponding operations and evidence exist.

### Import and export

Hide or clearly gate unreachable actions. When implemented, show progress, source preservation, adapter result, fidelity loss, rejected entities, unsupported content, and the exact exported revision.

### AI proposal review

Do not expose a success path until the product host exists. The eventual UI must show request, assumptions, grant, pinned revision, affected elements, typed operations, validation, preview, approval, commit result, provenance, and grouped undo.

## Release block

A visually complete shell, static page, isolated library test, or successful deployment does not satisfy this workflow. Release remains blocked until one revision passes the complete sequence on each claimed platform.
