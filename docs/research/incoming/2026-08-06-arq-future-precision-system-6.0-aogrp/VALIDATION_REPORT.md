# Validation report

**Package:** ARQ Future Precision System 6.0  
**Validation date:** August 6, 2026  
**Result:** Passed package-local validation

## Verified package-local results

- Reference unit tests: **21 passed**.
- New JSON Schemas: **10 passed Draft 2020-12 meta-validation**.
- New executable AOGRP fixtures: **10**.
- Custom healthy file begins with ARQ package magic, not the SQLite header.
- Bounded bootstrap and recovery-root opening passed.
- Deep object, manifest, revision, and semantic-root verification passed.
- Append revision passed.
- Failure before recovery-root publication reopened the previous generation.
- One corrupt recovery root fell back to the other valid root.
- Two corrupt recovery roots were rejected.
- Corrupt segment payload was rejected by deep validation.
- Unknown required capability returned preserving read-only mode.
- Unknown optional capability remained editable in the demonstration profile.
- Compact publication preserved semantic root.
- Injected failure before atomic promotion preserved the existing destination.
- MCP proposal scope, exact-digest approval, and replay rejection passed.
- YAML handoff parsed.
- UTF-8 and no-em-dash checks passed for the full package.
- Generated cache files were absent.

## Package facts before generated inventory and manifest

- Files: 379
- Markdown files: 264
- Approximate Markdown words: 57315
- New Version 6 files outside `background/`: 108
- New Version 6 Markdown files: 74
- Approximate new Version 6 Markdown words: 6751

Final inventory and hash manifest are generated after this report and verified again before ZIP creation.

## Evidence limits

- The Python reference is one implementation, not independent conformance.
- The demo uses deterministic float-free JSON, not production deterministic CBOR.
- The package magic, version, codecs, and IDs are not production allocations.
- Browser OPFS, native Rust, WebAssembly, crash-on-device, multi-gigabyte, kernel, and repository integration are not verified.
- The current repository immutable HEAD and accepted storage ADR remain unresolved.
- A passing package does not prove product implementation, release, security, or superiority.
