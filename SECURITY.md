# Security policy

## Status

Arq is in the planning/pre-implementation phase — there is no running service or
shipped code yet. This policy will be expanded once the first services and clients
described in `docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md` §22 (tenant isolation,
encryption, signed URLs, RBAC, sandboxed file parsing, etc.) exist to report against.

## Reporting a vulnerability

If you believe you've found a security issue in this repository or in Arq once it's
running, please report it privately rather than opening a public issue. Open a private
security advisory on this GitHub repository, or contact the repository owner directly.

Please include:

- a description of the issue and its potential impact;
- steps to reproduce, if applicable;
- any relevant logs, requests, or proof-of-concept material.

## Scope

Until Arq has a running service, in-scope reports are limited to this repository
itself (e.g. secrets accidentally committed, malicious dependency suggestions in a
pull request). Once services and clients exist, this file will be updated with
supported-version and disclosure-timeline details per §22 of the master plan.
