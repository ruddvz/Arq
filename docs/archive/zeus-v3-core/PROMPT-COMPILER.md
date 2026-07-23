# Zeus Prompt Compiler

The compiler converts normal language into the exact prompt an executor needs.

## Compilation pipeline

### 1. Intent normalization

Determine whether the user wants an answer, plan, implementation, audit, release,
incident response or end-to-end delivery. Resolve pronouns and references from project
context.

### 2. Context hydration

Inspect only relevant live sources:

- current repository, branch, status and diff;
- issue/PR and recent commits;
- accepted ADRs and current blueprint;
- contracts, schemas and current implementation;
- connected project files and prior decisions;
- current public primary sources when facts may have changed.

### 3. Requirement inference

Translate vague quality language into testable requirements.

Examples:

- “perfect” → all relevant quality gates, actual output inspection and no unresolved
  critical issue;
- “pixel perfect” → token fidelity, complete interaction states, viewport/DPR matrix,
  visual diffs, accessibility and reviewer-approved baselines;
- “fast” → explicit workload, hardware/environment and percentile budget;
- “secure” → threat model, authorization, secrets, untrusted input, dependency and
  rollback review;
- “works everywhere” → declared capability tiers and supported-device evidence.

### 4. Scope fence

Specify in scope, non-goals and protected existing behaviour. Do not expand a bounded
Arq task into a generic CAD/BIM platform rewrite.

### 5. Role and task graph

Choose one accountable role, reviewers and dependency waves. The compiled prompt must
state file/contract ownership or discovery instructions.

### 6. Acceptance compilation

Acceptance must be binary, observable and mapped to evidence. Include invalid, empty,
offline, permission, recovery and cross-device paths where relevant.

### 7. Verification binding

Discover actual repository commands. Do not invent package scripts. Bind each
acceptance criterion to a test, benchmark, screenshot, migration rehearsal, file
integrity check, CI check or production probe.

### 8. Delivery binding

State required branch, PR, CI, merge, deployment and production steps. If the user's
requested stop point is earlier, name the later stages as non-goals.

### 9. Recovery

Define undo, rollback, backup or incident response before destructive work.

## Compiled executor contract

```text
ROLE AND ACCOUNTABILITY
CURRENT EVIDENCE
OUTCOME
CURRENT STATE
SCOPE
NON-GOALS
ARQ INVARIANTS
AFFECTED SURFACES
TASK GRAPH AND DEPENDENCIES
BINARY ACCEPTANCE
LOCAL VERIFICATION
GITHUB AND CI GATES
DEPLOYMENT AND PRODUCTION GATES
SECURITY AND ROLLBACK
SENIOR REVIEW
HANDOFF FORMAT
STOP CONDITIONS
```

The contract must be self-contained enough for a capable executor to work without
inventing project facts. Never use generic directions such as “make the UI better” or
“check everything” without enumerating the exact surfaces and evidence.
