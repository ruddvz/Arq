---
source_id: ARQ-OS31-CHANGELOG-VALIDATION
source_type: validation-and-history
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ project administrator
---

# Changelog and validation

## 3.1.0, 4 August 2026

- Reduced the package from 41 files to exactly 25 total files.
- Defined exactly 24 numbered Markdown files as Project sources.
- Kept `ARQ_PROJECT_INSTRUCTIONS.txt` separate for pasting into Project settings.
- Left one of the 25 Plus Project file slots free.
- Consolidated machine records, JSON schemas, templates, manifest, checksum, testing, migration, implementation handoff, audit, and validation material into sources 16 through 23.
- Removed all dependency on extra validator scripts inside the Project upload set.
- Preserved authority boundaries, current repository and deployment snapshot, GitHub and Vercel protocols, evidence states, conflict handling, protected workflow, and implementation prompt.

## Product limits used

OpenAI's Projects documentation observed on 4 August 2026 states that Go and Plus Projects support 25 files, with 10 files uploaded at one time. OpenAI's July 2026 release notes state that Plus and other paid plans support up to 5,000 characters for custom instructions. The Projects article does not publish a separate Project-specific character number, so this package uses the documented 5,000-character paid-plan limit as a conservative ceiling.

## Package validation

- Total ZIP payload files: 25
- Uploadable Project sources: 24
- Pasted instructions files: 1
- Project Instructions characters: 4265
- Character headroom below 5,000: 735
- Numbered source sequence: 00 through 23, complete
- Duplicate filenames: none
- Duplicate-style suffixes: none
- Markdown front matter: present on all 24 sources
- Unique source IDs: 24
- UTF-8 decoding: passed
- Em dash characters: none
- Missing internal package references: none
- JSON dependency inside upload set: none
- ZIP extraction and recount: passed

## Scope boundary

This validation proves the structure and internal consistency of the Operator OS 3.1 Project package. It does not prove that repository, GitHub, Vercel, product, UI, MCP, security, performance, release, or conflict-resolution recommendations have been implemented.

## Source fingerprints

These shortened SHA-256 fingerprints cover sources 00 through 22. Source 23 is the validation record itself.

| Source | Bytes | SHA-256 prefix |
|---|---:|---|
| `00_README_FIRST.md` | 2498 | `ea5d3bf02e94a781...` |
| `01_SOURCE_REGISTRY_AND_AUTHORITY.md` | 4929 | `59cedbab22c996f6...` |
| `02_SYSTEM_ROLES_AND_AUTHORITY_BOUNDARIES.md` | 3608 | `ef75c06e59f3876b...` |
| `03_LIVE_REPOSITORY_AND_DEPLOYMENT_SNAPSHOT.md` | 4201 | `0da38047b519bdf1...` |
| `04_PRODUCT_SCOPE_AND_PROTECTED_WORKFLOW.md` | 3760 | `5b9c97a37c404210...` |
| `05_ARCHITECTURE_FILE_STATE_AND_INVARIANT_BRIDGE.md` | 3547 | `55a8eede5fa1191c...` |
| `06_TASK_COMPILATION_AND_EXECUTION_HANDOFF.md` | 3245 | `2b80f60339289819...` |
| `07_GITHUB_CHANGE_CONTROL_PROTOCOL.md` | 3419 | `c79eb838a6113ab5...` |
| `08_VERCEL_DEPLOYMENT_AND_PRODUCTION_PROTOCOL.md` | 3774 | `b7c7eca0a0130304...` |
| `09_AI_MCP_AUTOMATION_TRUST_BOUNDARY.md` | 2753 | `3505caf2ff2a56ab...` |
| `10_UX_LANGUAGE_BRAND_AND_PUBLIC_CLAIMS.md` | 3642 | `4beac3aef67f2ee3...` |
| `11_SECURITY_PRIVACY_DATA_AND_SUPPLY_CHAIN.md` | 2990 | `8b14aea63dcc68f6...` |
| `12_PLATFORM_PERFORMANCE_TEST_AND_EVIDENCE.md` | 3060 | `41eb8e631bb1a4aa...` |
| `13_RELEASE_INCIDENT_ROLLBACK_AND_EVIDENCE_GATES.md` | 3137 | `c0ccd9a22aa424c2...` |
| `14_DECISIONS_RISKS_CONFLICTS_AND_OPEN_QUESTIONS.md` | 4387 | `6304342d463f077a...` |
| `15_SOURCE_MAINTENANCE_AND_PROJECT_UPLOAD_GUIDE.md` | 2419 | `bf3dc5099f7d81ac...` |
| `16_EVIDENCE_STATES_AND_VERIFICATION_LEDGER.md` | 2953 | `077148862ddae48a...` |
| `17_INTEGRATION_CONTRACTS_AND_SCHEMAS.md` | 3682 | `84cac61982c72a6d...` |
| `18_OPERATOR_TEMPLATES.md` | 2389 | `2ff654b612b2b544...` |
| `19_OPERATOR_WORKFLOWS.md` | 3397 | `52185fd643a9966d...` |
| `20_CRITIQUE_AND_IMPROVEMENT_REPORT.md` | 5659 | `d97e30d561bc194e...` |
| `21_MIGRATION_FROM_OPERATOR_OS_2.md` | 1994 | `92cbd5a1531f58ab...` |
| `22_REPOSITORY_IMPLEMENTATION_PROMPT.md` | 5760 | `52ae15b9db6b6da2...` |

## Prior versions

3.0 introduced the control-plane architecture, connected-system protocols, handoff schema, evidence states, and live audit, but packaged 41 files. 2.0 separated intended direction from implementation evidence but had a broken validator and duplicated repository authority. 1.0 was the initial operating package.
