# Context and token budgets

| Tier     | Modules | Sources | Retrieved characters | Visible contract |
| -------- | ------: | ------: | -------------------: | ---------------: |
| Fast     |       1 |       4 |                8,000 |       ≤700 chars |
| Standard |       4 |      10 |               28,000 |     ≤1,500 chars |
| Deep     |       8 |      24 |               80,000 |     ≤3,000 chars |

Rules:

- Load paths/headings before content.
- Read exact line ranges or snippets, not entire long files.
- Summarise evidence once into a ledger and reuse it.
- The compiled contract (mode/risk/tier/owner/acceptance/checks) is echoed via the
  prompt hook on every actionable prompt; do not additionally re-quote full module or
  policy text in conversational replies.
- Do not load visual, release or security modules without a trigger.
- Fresh public facts use current primary sources; stable project facts use cached
  fingerprints and live repository evidence.
- Exceed a budget only when a critical unresolved decision cannot be answered safely
  within it; record why.
