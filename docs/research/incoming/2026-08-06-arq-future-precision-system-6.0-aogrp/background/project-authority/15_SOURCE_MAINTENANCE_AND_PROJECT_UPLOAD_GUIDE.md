---
source_id: ARQ-OS31-MAINTENANCE
source_type: maintenance
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ project administrator
---

# Source maintenance and Project upload guide

## Upload set

Upload all 24 numbered Markdown files, `00` through `23`. Do not upload `ARQ_PROJECT_INSTRUCTIONS.txt`; paste its contents into Project settings.

Recommended batches:

1. `00` through `09`
2. `10` through `19`
3. `20` through `23`

This keeps the Project at 24 sources and leaves one Plus source slot free.

## Do not keep active

- Operator OS 1.0, 2.0, or 3.0 files once 3.1 is installed.
- Filenames ending in `(1)`, `copy`, `final-final`, or similar suffixes.
- Copied ZEUS, Engineering OS, Language System, ADR, or repository invariant trees when live repository access exists.
- Historical implementation packs without a clear historical label.
- Generated manifests, checksums, test logs, schemas, and tools that duplicate the consolidated controls in sources 16 through 23.
- Secrets, credentials, private keys, personal tokens, or unnecessary personal information.

## Refresh triggers

Refresh the Project sources when a material repository ADR, schema, migration, file-state contract, protected workflow, release scope, ZEUS authority, Engineering OS rule, Language System rule, MCP boundary, security control, default branch, production deployment, or blocking conflict changes.

## Refresh procedure

1. Resolve the live repository, branch, immutable HEAD, open PRs, and deployment identifiers.
2. Read current repository instructions and authority files.
3. Compare the active sources against current code, accepted decisions, CI, and runtime evidence.
4. Mark stale, superseded, and conflicting claims before adding replacements.
5. Update source 03 with observation and expiry dates.
6. Update sources 14, 20, 22, and 23 when findings or implementation priorities change.
7. Confirm exactly 24 numbered source files remain.
8. Confirm all files use UTF-8, unique source IDs, valid front matter, stable names, and no em dash characters.
9. Replace old Project sources before uploading the refreshed set.

## Retrieval discipline

Load only the sources relevant to the task. For repository work, use these files to frame the task and retrieve current evidence, then hand execution to repository ZEUS. Do not treat Project summaries as a substitute for current-head inspection.
