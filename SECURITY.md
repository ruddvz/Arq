# Security policy

Arq is currently pre-release.

## Reporting

Create a private security advisory in the repository after it exists. Do not report
unpatched vulnerabilities through public issues.

## Security baseline

- Server-side authorisation
- Private projects by default
- Short-lived signed file URLs
- Dependency and secret scanning
- File-size and complexity limits
- Sandboxed or isolated import processing
- No training on private project data by default
- Audit events for sharing, export and permission changes
- Recovery that does not expose private project content

See `docs/security/` for the detailed threat model and review checklist.
