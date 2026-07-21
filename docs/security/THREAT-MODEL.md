# Threat model

Assets:

- private designs;
- addresses;
- client data;
- exports;
- access tokens;
- AI prompts;
- comments;
- audit events.

Threats:

- cross-tenant access;
- malicious files;
- zip bombs;
- path traversal;
- parser exhaustion;
- prompt injection;
- account takeover;
- insecure links;
- stale permissions;
- client-side secrets;
- supply-chain compromise.

Controls are specified in `SECURITY-REVIEW-CHECKLIST.md`.
