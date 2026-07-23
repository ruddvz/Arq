# @arq/telemetry

Privacy-conscious product analytics (§24) - no raw geometry, project names, or prompt text by default.

`redactSensitiveFields` (ARQ-155) enforces that promise: strips blueprint
section 118's "do not collect by default" fields (geometry, project name,
address, raw prompt, sheet content, client name) from an event object before
it is logged or sent anywhere. See `security/THREAT-MODEL.md` for the full
threat model this package's own privacy promise is one control within.

Event capture/transport itself is not yet implemented - this package remains
otherwise a workspace placeholder.
