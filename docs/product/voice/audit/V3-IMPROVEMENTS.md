# What Version 3.0 fixes in the Arq language system

Version 2.0 established a strong canonical vocabulary, state map and source-aware
foundation. Version 3.0 makes that foundation safe to evolve and safe to install.

## 1. Package validation no longer mistakes a dated snapshot for a permanent contract

The 2.0 validator required exactly 5 modes, 54 tools, 30 workspace surfaces and
57 route surfaces. That makes a healthy product expansion look like a language
system failure. 3.0 validates identity, uniqueness, source linkage and complete
coverage instead. Counts remain visible as snapshot facts, not release blockers.

## 2. Installation is now complete and checkable

The 2.0 install map did not copy the dated snapshots consumed by
`build-language-context.mjs`, and it omitted several canonical standards and
machine checks. A clean repository integration could therefore fail after a
seemingly successful copy. 3.0 adds an install-map verifier and maps every
required consumer artifact deliberately.

## 3. Freshness covers the sources that can actually change a user claim

The earlier generated context tracked core registries but did not track all of
the current marketing content, the live plan journal, the canvas implementation
or the local-storage boundary. 3.0 adds a source contract. It declares exactly
which files and directories must be hashed, why each matters, and which claims
must be reviewed when they change.

## 4. Context generation is deterministic and does not leak a developer path

2.0 stored a local repository-root hint and had no source-set digest. 3.0 does
not persist an absolute machine path. It writes a deterministic source digest
and refuses to replace a context with one built from missing required sources.

## 5. State coverage now includes adapters between implementation and product language

The workspace registry correctly models `saved-local`, `saving-local` and
`local-save-failed`. The live demo also exposes journal states such as
`recovered` and `unsaved-changes`. A registry-only check could pass while those
visible states had no canonical treatment. 3.0 adds a state-adapter map and a
separate local-journal state family.

## 6. Claim governance now reaches rendered public copy

Regex rules are useful triage, but warnings alone cannot prove that public copy
was reviewed. 3.0 adds a claim-binding contract, a rendered-site test fragment,
and expiring review acknowledgements. High-risk public claims must identify the
claim ID, scope, evidence route and owning source rather than relying on prose
that merely sounds careful.

## 7. Conflicts now have resolution criteria, not just a warning label

Each unresolved record carries the blocked surfaces, required evidence, expected
resolution checks and the claim IDs that must remain non-current. This turns a
conflict register into a release-control mechanism.

## 8. Support and product AI receive an evidence envelope

The five answerability outcomes remain unchanged. 3.0 adds a separate response
disposition and a private evidence envelope: source digest, claim IDs, conflict
IDs, revision scope and data-minimisation requirements. The user-facing answer
stays simple; the system can still prove why it said it.

## 9. UI wording has a semantic contract

The new message contract handles the places where polished wording can most
easily change product meaning: compatibility versus opening, journal persistence
versus portable-file publication, local save versus sync, read-only causes,
recovery, permission and stale AI proposals.

## 10. Consumer compatibility is versioned

Support, AI and future integrations cannot silently consume a changed language
bundle. 3.0 declares additive, compatible and breaking changes, plus the
minimum context fields a consumer must understand before it may answer.
