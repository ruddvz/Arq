# Security and Supply-Chain Protocol

## Required security review surfaces

- trust boundaries and assets;
- authentication and authorization;
- secrets and credentials;
- untrusted `.arq`, IFC, DXF, PDF, image and archive input;
- parser/file/entity/decompression/resource limits;
- path traversal and unsafe file names;
- SQLite defensive configuration and extension loading;
- browser isolation, worker messages and cross-origin policy;
- sync preconditions, replay and authorization;
- AI prompt/tool injection and data exposure;
- dependency provenance, lockfile, licenses and known vulnerabilities;
- CI token permissions and untrusted fork behaviour;
- artifact signing/provenance where release policy requires it;
- logging and privacy.

## Dependency changes

A new dependency requires current primary-source review, license compatibility,
maintenance/security posture, bundle/runtime cost, update strategy and removal plan.
Lockfile changes must be scoped and reviewed.

## Secrets

Never print, commit, prompt-log or attach secrets. Use least-privilege short-lived
credentials. Production secrets are never required for local tests. Secret scanning
failures are release blockers.

## CI security

- pin or review third-party actions according to repository policy;
- avoid write tokens for untrusted pull-request code;
- do not expose secrets to forked PRs;
- restrict deployment environments and approvals;
- preserve audit trail for workflow re-runs and merges.

## Security stop conditions

Stop before merge if authorization is untested, a secret is exposed, an untrusted-file
path lacks limits, a critical dependency issue is unresolved or rollback cannot
preserve project data.
