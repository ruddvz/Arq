# Permission, privacy, and security copy

## Roles

Canonical role names:

- Owner
- Administrator
- Editor
- Commenter
- Viewer

Do not invent “member”, “manager”, “collaborator”, or “guest” as permission roles unless a separate canonical role is added.

## Permission denial

Say what permission is required.

Good:

> You need Editor access to modify the model.

Good:

> Only the project Owner can delete this project.

Avoid:

> You are not allowed to do this.

## Capability versus permission

Keep separate:

- “This feature is not available in this build.”
- “You do not have permission to use this feature.”

A hidden backend or gated feature is not a permission problem.

## Offline versus permission

Do not imply a role problem when the real blocker is network dependency.

Good:

> Share links are unavailable while offline. Your local project remains available.

## Security claims

Never imply an audit, certification, encryption property, privacy property, or compliance standard that is not explicitly evidenced.

Do not use:

- secure by default
- enterprise-grade security
- certified
- fully encrypted
- zero-trust
- compliant

unless the exact scope is proved and current.

## Private project data

Support, telemetry, and AI language must respect the project's privacy rules.

Do not request or record raw project geometry, project addresses, confidential names, or raw prompts merely to diagnose a generic issue.

Ask for:

- stable error code;
- app/build version;
- browser/OS where relevant;
- affected surface;
- reproducible steps;
- whether the project opens read-only;
- coarse object/error counts;
- a user-approved support bundle when one exists.

## Vulnerabilities

Never direct an unpatched vulnerability to a public issue.

Use the project's private security reporting path.
