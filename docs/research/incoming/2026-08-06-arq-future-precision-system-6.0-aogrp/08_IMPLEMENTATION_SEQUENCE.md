# Implementation sequence

## Phase 0: repository reconciliation

Resolve immutable HEAD, current format identity, accepted ADRs, storage ownership, current fixtures, and active PR overlap. Do not change production files.

## Phase 1: independent object model

Create `arq-object-model` with exact quantities, deterministic payload rules, content IDs, revision objects, capabilities, and golden vectors. Integrate neither SQLite nor UI initially.

## Phase 2: AOGRP experimental reader and writer

Create `arq-pack` behind an experimental feature flag. Support bounded preflight, object packs, revision packs, dual recovery roots, full validation, and source-preserving publication.

## Phase 3: dual materialisation bridge

Export a known semantic fixture from current SQLite `.arq` into AOGRP and materialise it back into an isolated SQLite candidate. Compare semantic root, entity identity, operations, views, sheets, and assets.

## Phase 4: browser worker prototype

Read the experimental pack in a worker using bounded ranges. Build a disposable query index. Test cancellation, memory limits, corruption, and Safari fallbacks.

## Phase 5: product-open experiment

Add a clearly experimental open path for package fixtures. It must never overwrite user files and must not replace current format without accepted architecture.

## Phase 6: collaboration and partial loading

Add revision reachability, sparse manifests, segment transfer, and semantic merge after single-user publication is dependable.

## Phase 7: domain expansion

Add exact geometry, assemblies, product, vehicle, aerospace, and city packs only after the protected architecture workflow and core persistence gates pass.
