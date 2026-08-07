# Signing and attestation

Signatures attest to exact bytes or domain-separated records, not vague project meaning. Signature records name algorithm, key identifier, signer role, scope, project, revision, publication hash, evidence digest, timestamp source, and verification status. A valid signature does not establish safety, code compliance, authorship of all content, or trust in external assets. Revocation and key rotation must be supported.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.
