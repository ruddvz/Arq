---
source_id: ARQ-OS3-PLATFORM-PERFORMANCE
source_type: verification-governance
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ QA and performance owners
---

# Platform, performance, test, and evidence system

## Capability matrix rule

A platform name is not a support claim. Record each capability separately for each browser, operating system, device class, input method, and deployment mode.

Minimum capability cells:

- load public site;
- load app shell;
- create project;
- draw and edit semantic elements;
- local journal and recovery;
- open portable `.arq`;
- migrate and reopen;
- publish portable `.arq`;
- 3D view;
- sheet and vector PDF;
- import and export;
- offline behaviour;
- sync and collaboration;
- AI proposal and apply;
- keyboard, touch, Pencil, screen reader, reduced motion;
- crash, quota, permission, cancellation, and corrupt-input recovery.

Each cell needs status, revision, fixture, command or runtime procedure, device and browser, result, evidence location, date, and verifier.

## Performance evidence record

Never publish `fast`, `instant`, `smooth`, or a supported project size without:

- exact hardware and OS;
- browser and runtime versions;
- cold or warm state;
- network state;
- corpus and project complexity;
- operation sequence;
- sample count and percentile;
- measurement method;
- pass budget and regression threshold;
- source commit;
- result artifact;
- known variance and limitations.

## Immediate performance findings

The observed Vercel build produced an initial web JavaScript bundle of about 1,136 kB minified and 326 kB gzip, with a chunk-size warning. This does not prove poor runtime performance, but it is sufficient to require route and capability splitting, bundle attribution, an initial-JavaScript budget, and a regression gate.

The Vercel build installed all workspaces and compiled `better-sqlite3` from source. This is a build-performance and supply-chain concern. Measure clean and cached build time after narrowing the deployment dependency closure.

## Test ladder

1. focused unit or contract test;
2. affected package tests;
3. integration and capability check;
4. architecture and language gates;
5. repository build and Engineering OS evidence;
6. browser and accessibility evidence;
7. migration, recovery, and destructive negative tests;
8. preview deployment and route checks;
9. production observation and rollback readiness.

Use the minimum ladder that reaches the requested delivery stop. Protected work cannot accept cached results or evidence from another revision.

## Claim evidence schema

Use the evidence contract in source 16. Only `verified` is Green. `partially-verified`, `inferred`, `assumed`, `blocked`, `not-inspected`, and `failed` remain explicit.

## Visual QA

A pixel-level claim requires a pinned reference, viewport, browser, device scale, fonts, deterministic fixtures, disabled animation, and an actual screenshot comparison. Source review alone can identify UX gaps, but must not be labelled a visual verification.
