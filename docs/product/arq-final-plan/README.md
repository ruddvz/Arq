# ARQ complete execution programme

This package is the read-only ARQ repository audit and end-to-end execution plan prepared 15 September 2026.

Open `../ARQ-Execution-Plan.html` for the searchable visual planning book or `../ARQ-Execution-Plan.md` for the complete Markdown reading copy. `programme.json` is the machine-readable source used to generate them. `phases/` contains one contract per phase. `registers/` contains CSV crosswalks for every captured issue, pull request, branch, original ARQ backlog item, prior production slice, implementation-pack task, research source, feature, command, risk, edge case, QA case, package, page, component and flow specification. `evidence/` contains the raw GitHub captures, branch/history inventories, local working-tree snapshots, prior plans and fresh check logs.

The programme has 48 lifecycle phases and 192 outcome obligations. It preserves the existing ARQ P0–P10, UX-0–UX-8, ARQ-001–242, S01–S44 and issue ownership systems. It does not claim that code, a closed issue, a passing library test or a generated plan is a released product.

## Rebuild

From this directory, run:

```sh
python3 build.py
```

The generator rebuilds the root Markdown, JSON copy, phase cards and all CSV registers from `programme.json`. It does not fetch GitHub or alter the repository. Refresh the audit inputs first when the repository changes, then regenerate and rerun validation.

## Validation

The programme was checked for 48 phases, 192 obligations, valid phase references, acyclic dependencies and 2,337 source records. The included browser check opened the HTML, found all 48 cards, searched the phase list and filtered the register. The evidence logs record fresh `pnpm test` (360 files, 4,080 passed, 4 skipped), uncached typecheck (37 packages passed), formatting failure (eight files), native-open Chromium pass and design-system dialog/command Chromium pass.

## Authority boundary

Live implementation, accepted ADRs and exact-head executable evidence outrank this plan. The GitHub default branch still requires the separate #332 governance migration. Local dirty work remains preserved as evidence and requires an owner-led disposition. The 99.99% request is represented as measurable integrity and reliability targets with denominators and confidence requirements, not as a claim that unknown bugs have been eliminated.
