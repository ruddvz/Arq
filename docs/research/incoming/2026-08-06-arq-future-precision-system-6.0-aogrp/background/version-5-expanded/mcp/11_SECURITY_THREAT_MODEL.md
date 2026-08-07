# MCP security threat model

Threats include confused deputy, issuer mix-up, audience confusion, tool-name/header mismatch, proposal replay, approval replay, stale revision, oversized schema, prompt injection from project text, exfiltration through exports, arbitrary URLs, task resource exhaustion, and malicious MCP App content. Controls include header-body consistency, issuer and audience binding, strict schemas, scoped grants, egress policy, quotas, exact-digest approval, single-use tokens, task cancellation, and audit.
