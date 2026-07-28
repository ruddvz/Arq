# Copy-impact PR checklist

Use this when a PR changes product behaviour, a canonical name, state, role, file format, capability, roadmap item, AI rule or public claim.

- [ ] Identify the canonical source that changed.
- [ ] Run the language impact report.
- [ ] Refresh generated repo context.
- [ ] Verify source-contract coverage before refresh.
- [ ] Verify state-language coverage.
- [ ] Verify implementation-state adapters when UI state changed.
- [ ] Verify claim bindings and conflict gates.
- [ ] Update visible product copy where behaviour changed.
- [ ] Update support intent/answer rules where troubleshooting changed.
- [ ] Update AI context or proposal language where capability changed.
- [ ] Update documentation and onboarding.
- [ ] Update marketing only after current-state evidence supports the claim.
- [ ] Update or remove rendered public claim bindings where wording/state changed.
- [ ] Update claim state when a feature changes CURRENT/PLANNED/GATED/etc.
- [ ] Update import/export fidelity wording if conversion behaviour changed.
- [ ] Update permission copy if RBAC changed.
- [ ] Update recovery/migration copy if project-format behaviour changed.
- [ ] Add regression coverage for the contradiction or drift class.
- [ ] Resolve any `CONFLICTED` fact before promoting a stronger claim.
- [ ] Check language consumer compatibility and evidence-envelope impact.
