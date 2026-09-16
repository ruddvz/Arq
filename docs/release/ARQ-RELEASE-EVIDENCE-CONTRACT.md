# ARQ release evidence contract

Issue authority: #453. Programme authority: #367. Existing checklist: `docs/RELEASE-READINESS-GATE.md`.

This contract turns release readiness into a deterministic decision over current evidence. It does not replace Engineering OS, ZEUS evidence/gate ledgers, the capability ledger from #370, browser/device acceptance, security evidence, or human/legal decisions. Those systems remain the evidence providers. This layer answers one narrower question: **does the evidence bound to this exact candidate revision satisfy the selected release stage?**

## Release stages

The machine-readable source is `ARQ-RELEASE-POLICY.v1.json`.

| Stage             | Audience                       | Purpose                                                                                                       |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `engineering`     | engineering only               | Prove the candidate can be reasoned about and built. Not a user release.                                      |
| `internal`        | internal users/testers         | Exercise current product paths without making an external support claim.                                      |
| `architect_alpha` | controlled external architects | Permit bounded real-workflow validation only after project-format, rollback and human/device evidence exists. |
| `beta`            | broader external testers       | Add deployment-identity evidence to the alpha floor.                                                          |
| `stable`          | supported external release     | Add production-smoke evidence and require the full supported evidence envelope.                               |

A later stage is not inferred from an issue count, branch name, tag, successful build, or provider-ready status. The release manifest names the stage explicitly and must satisfy that stage's evidence classes at the exact release revision.

## Bug severity, not programme phase

`P0` through `P4` in this contract are **bug severities**. They are not the P0/P1/P2 programme phases in #367.

- **P0:** data loss or semantic corruption, wrong-project/document mutation, security/privacy boundary breach, false durability or publication success, or unrecoverable migration. P0 is release-stop for `architect_alpha`, `beta` and `stable`.
- **P1:** critical protected workflow or recovery failure that prevents trustworthy architectural work without a safe supported workaround. P1 is also release-stop for `architect_alpha`, `beta` and `stable`.
- **P2:** major degradation with a bounded supported workaround and no silent corruption/false durability. An open P2 blocks `stable` unless the owner explicitly accepts it with a recorded approval reference and user impact.
- **P3:** minor correctness or usability defect outside release-stop workflows.
- **P4:** cosmetic, polish or future-backlog defect with no material workflow correctness impact.

Release-stop P0/P1 defects cannot be waived through this contract. An implementation agent, reviewer, or CI job cannot turn one green. P2 stable waivers require an owner approval reference and explicit user impact; P3/P4 still remain visible known issues but do not automatically block a stage.

## Exact-head rule

Every release manifest carries one `releaseRevision`, a full Git SHA. `integrationAuthority.sha` must equal it. Required evidence is green only when all of the following are true:

1. its evidence state is `verified`;
2. its `revision` equals `releaseRevision`;
3. it is not a cached result being substituted for current protected evidence;
4. its source is named so the receipt can be inspected;
5. any required human evidence names the human approval receipt for that same revision/build.

A new commit after a required receipt makes that receipt stale for the new candidate. The validator does not guess that an earlier pass is still valid because the diff looked unrelated. Future optimisation may use an approved impact graph to decide which evidence must be rerun, but the manifest must still record an exact-head verified receipt for every class required by its stage.

Open pull requests do not count as merged product truth. In particular, #370 capability projections may describe candidate providers conservatively, but a release manifest cannot promote an open provider PR into current merged capability truth.

## Evidence classes

The v1 policy uses these classes:

- `static_quality`: formatting/lint/type/static policy evidence selected by the repository gate;
- `unit`: deterministic unit/property/regression evidence;
- `build`: build/package evidence for the release candidate;
- `security`: current security/resource-boundary evidence selected for the candidate;
- `browser_capability`: real-browser product-path evidence selected for affected workflows;
- `capability_ledger`: exact-head #370 capability truth used by release/public-claim decisions;
- `project_format`: `.arq` schema/application-id/open/publish/reopen compatibility evidence as applicable;
- `rollback_compatibility`: proof that the named rollback target can safely handle the candidate's project-format consequences;
- `human_device`: approved browser/device/accessibility evidence that cannot be inferred from simulation alone;
- `deployment_identity`: proof that the deployed build is the candidate revision/artifact;
- `production_smoke`: post-deployment proof for the stable release candidate.

These are release evidence categories, not replacement test runners. The source field points back to the workflow run, evidence ledger, receipt, or immutable artefact that actually proves the claim.

## Manifest contract

A release manifest is an evidence index, not evidence itself. It has this shape conceptually:

```json
{
  "schemaVersion": 1,
  "policyId": "arq-release-evidence-v1",
  "releaseStage": "architect_alpha",
  "releaseRevision": "<40-char git sha>",
  "integrationAuthority": { "branch": "main", "sha": "<same sha>" },
  "evidence": [
    {
      "id": "browser-core-workflow",
      "class": "browser_capability",
      "state": "verified",
      "revision": "<same sha>",
      "source": "<workflow/receipt reference>",
      "cached": false
    }
  ],
  "knownIssues": [],
  "rollback": {
    "targetRevision": "<40-char rollback sha>",
    "projectFormatCompatibilityEvidenceId": "rollback-project-format"
  },
  "publicClaims": []
}
```

The validator derives PASS/BLOCK from the policy and evidence. Do not hand-author a `green`, `ready`, `passed` or percentage field inside the manifest.

### Known issues

Each known issue records its issue reference, bug severity, `open`/`closed` state and user impact. If the severity blocks the selected stage:

- P0/P1 remains a hard blocker;
- P2 at `stable` needs an owner-approved waiver with `approvedByRole: "owner"`, `approvalRef` and `userImpact`;
- an agent-authored approval reference is not an owner waiver.

### Rollback

Stages that require rollback evidence must name a full rollback target SHA and point to an exact-head `rollback_compatibility` receipt. A code rollback is not enough when the candidate may have written a newer or incompatible project representation. The receipt must cover project-format compatibility, migration/recovery implications, or the explicit reason rollback is safe.

### Public claims

If `publicClaims` is non-empty, the manifest must include exact-head verified `capability_ledger` evidence. Each claim names a stable `capabilityId` and a `claimRef`. This does not replace the Arq Language System or #370 public-claim eligibility; it prevents a release bundle from making claims while omitting the capability evidence those authorities require.

## Validator

Validate the canonical policy alone:

```sh
node scripts/verify-release-evidence-contract.mjs
```

Validate a candidate manifest against an expected release head:

```sh
node scripts/verify-release-evidence-contract.mjs \
  --manifest path/to/release-manifest.json \
  --expected-revision <40-char-git-sha>
```

The command prints `PASS`, `FAIL` or `BLOCK` reasons and exits non-zero for an invalid or blocked manifest. `FAIL` means the manifest/policy is malformed or violates the contract. `BLOCK` means the structure is valid but required release evidence or release-stop conditions are not satisfied.

## Authority boundaries

This contract deliberately does not:

- merge, deploy, tag or promote a release;
- weaken Engineering OS selected evidence;
- treat ZEUS gate records as the underlying test result;
- replace #370 capability derivation;
- generate browser/device human approval;
- decide legal/privacy/retention policy;
- mutate `.arq` persistence or migration behavior;
- waive release-stop P0/P1 defects;
- infer production identity from a branch or PR name.

Engineering OS remains merge authority. ZEUS may classify and record evidence but may not pass missing evidence. The Language System remains public/product wording authority. #370 remains capability-truth authority. This release contract only binds those authorities to one release candidate and one stage.

## v1 implementation stop point

The first #453 tranche establishes the policy, validator, regression tests and this contract. Workflow wiring and generated release bundles are follow-up work after the contract is reviewed against current Engineering OS and #370 integration. No production release action is authorised by this tranche.
