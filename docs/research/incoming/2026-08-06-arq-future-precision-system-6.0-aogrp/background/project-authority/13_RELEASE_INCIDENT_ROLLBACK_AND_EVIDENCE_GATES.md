---
source_id: ARQ-OS3-RELEASE-GATES
source_type: release-governance
class: C
status: active-bridge
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ release owner
repository_authority: engineering/ and repository workflows
---

# Release, incident, rollback, and evidence gates

## Authority

Engineering OS 5.0 and protected repository workflows decide merge and release evidence. This Project can prepare, inspect, and report evidence. It cannot mark a release Green when deterministic gates are missing or red.

## Release states

| State | Required meaning |
|---|---|
| Proposed | Release content described, no implementation claim |
| Candidate | Identified source SHA and artifact or deployment exists |
| Verified candidate | Required checks pass on that exact SHA and artifact |
| Approved | Required human and policy approvals recorded |
| Released | Production promotion observed and identified |
| Monitored | Post-release health and claim checks completed |
| Rolled back | Known-good prior state restored and verified |
| Blocked | A required proof, decision, permission, or environment is missing |

## Release evidence bundle

- source repository, base, head, and merge SHA;
- Engineering OS result and selected evidence;
- Language System result for governed copy;
- dependency, licence, SBOM, and secret results;
- schema, migration, file, recovery, and corruption evidence when affected;
- browser, platform, accessibility, and performance evidence when claimed;
- preview deployment and route results;
- production deployment ID and source provenance;
- runtime observation;
- rollback candidate and tested procedure;
- known failures and accepted residual risks;
- owner approval.

## Shadow-to-required gate transition

The observed Engineering OS gate is in shadow mode. Move it to required only after:

1. selected evidence is deterministic for representative change classes;
2. unavoidable proof gaps have an accepted policy;
3. workflow controls and instrument self-protection pass;
4. required check names are stable and unique;
5. branch rules are tested without trapping maintainers in an unrecoverable state;
6. bypass ownership and audit are defined;
7. a rollback for ruleset configuration is documented.

Do not solve a red gate by weakening a rule or changing a baseline without evidence.

## Incident response

Use the incident report template in source 18.

Minimum sequence:

1. stop further harmful mutation;
2. preserve logs, source revision, deployment, project copies, and artifacts;
3. identify scope and affected data;
4. distinguish canonical data loss from derived-cache or UI failure;
5. restore the safest known state;
6. communicate only verified facts;
7. fix root cause;
8. add regression tests and monitoring;
9. update sources, risks, and public claims;
10. complete a no-blame review with owners and deadlines.

## Rollback rule

Rollback is a tested path, not a paragraph. For persistent formats, preserve source and failed copies. For GitHub, record reverted commits and current head. For Vercel, verify aliases, routes, assets, headers, runtime, and source SHA after rollback.
