# Version 3.0 forensic audit

## Verified archive facts

The previous 3.0 package directory was inspected locally. It contained 23 files and approximately 3,020 Markdown words. Its own validation report claimed 214 files, 142 Markdown files, approximately 35,815 Markdown words, 20 JSON Schemas, executable fixtures, tests, a reference implementation, and a retained 2.0 background package.

Those claims were materially inconsistent with the archive. This is classified as **Failed evidence**, not a minor documentation defect.

## Root causes

- Inventory claims were written manually instead of derived from the final archive.
- The validation report was not coupled to a reproducible validator shipped with the package.
- Claimed generated artifacts were omitted from the delivered directory.
- A successful narrative review was treated as equivalent to executable conformance.
- The package did not force source, schema, fixture, and test claims to resolve to actual paths.
- Repository access failure was disclosed, but the package still sounded more implementation-complete than its evidence allowed.

## Consequences

- A repository executor could not distinguish real artifacts from described artifacts.
- Claimed schemas and tests could not be run.
- The reported ZIP hash did not prove the semantic claims inside the report.
- Trust in every other verification statement was reduced.
- Version numbering created a false impression of maturity.

## Version 5.0 fixes

1. Generate `PACKAGE_INVENTORY.json` from the final directory.
2. Generate `MANIFEST_SHA256.txt` from final file bytes.
3. Ship `tools/validate_package.py` and `tools/run_all_checks.py`.
4. Validate every JSON Schema with Draft 2020-12 meta-validation.
5. Parse the candidate SQL in an isolated SQLite database.
6. Generate healthy and damaged `.arq` demonstration fixtures.
7. Execute unit tests for canonical encoding, publication, operation preconditions, merge conflicts, and MCP approval replay.
8. Exclude inventory and manifest self-references from circular claims.
9. Record the exact Python and SQLite versions used.
10. Mark repository-dependent facts as Blocked.

## Remaining limitation

Package-local tests prove only the package demonstration. They do not prove compatibility with the current ARQ repository, browser runtime, production `.arq` files, Vercel deployment, or any chosen geometry kernel.
