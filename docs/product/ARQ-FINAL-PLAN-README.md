# ARQ final end-to-end execution programme

This is the current planning baseline for taking ARQ from repository recovery through a reliable, downloadable product. The canonical human-readable plan is [ARQ-FINAL-END-TO-END-EXECUTION-PLAN.md](./ARQ-FINAL-END-TO-END-EXECUTION-PLAN.md). A searchable visual version is available in [ARQ-FINAL-END-TO-END-EXECUTION-PLAN.html](./ARQ-FINAL-END-TO-END-EXECUTION-PLAN.html), with machine-readable data in [ARQ-FINAL-END-TO-END-EXECUTION-PLAN.json](./ARQ-FINAL-END-TO-END-EXECUTION-PLAN.json).

The accompanying [arq-final-plan](./arq-final-plan/) directory contains the 48 phase briefs, obligation and feature registers, GitHub inventory, source crosswalk, evidence captures, and the reproducible `build.py` generator. It was prepared on 2026-09-15 from integration head `a02ccc69e44e41324324c9482a43edbfb58e7905` (`main`).

This programme is a proposed execution plan, not a release certification. Evidence is authoritative in this order: current code and reproducible checks, accepted ADRs and contracts, the capability ledger and issue/PR records, then this plan and its recommendations. The plan records known failures and product gaps instead of treating them as completed work. “99.99%” is converted into measurable release gates with explicit denominators, severity limits, recovery objectives, and support evidence.

To regenerate the package after an approved inventory refresh:

```bash
cd docs/product/arq-final-plan
python3 build.py
```

The next execution frontier is the safe integration path: protect `main`, close the formatting and preview-CI failures, finish native editor persistence without flattening rich reference projects, and prove the complete new-project → author → sheet/PDF → publish → close → fresh-reopen journey before expanding scope.
