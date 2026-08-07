# Release, migration, and rollback

## Format-affecting release requirements

- Accepted ADR and allocated identifiers.
- Schema and migration review.
- Backward-read and supported-writer matrix.
- Healthy and damaged fixture suite.
- Copy-on-write migration and rollback evidence.
- Independent reader result where conformance is claimed.
- Browser storage and publication evidence.
- Security, licence, SBOM, and dependency review.
- Public wording reviewed by the ARQ Language System.

## Rollback

Application rollback must consider whether a newer writer has published files that an older build cannot safely edit. A deployment rollback alone may strand projects. Release evidence therefore includes file-version compatibility, migration reversibility, old-reader behaviour, and a recovery tool or read-only fallback.
