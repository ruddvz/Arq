# Security, limits, encryption, and signing

**Implementation status: none of this document's encryption or signing content
is implemented anywhere in `reference-v6/`.** A search for `encrypt`,
`sign`, and `hmac` across that tree returns zero hits. Only the budget
paragraph below has a working (if incomplete — see the package's
`TRIAGE-README.md` finding 4) implementation. This status note is
co-located here deliberately: `24_RELEASE_PROFILE_AND_NON_CLAIMS.md`
disclaims encryption/signing elsewhere in the package, but a reader of this
document alone, written entirely in present tense, would reasonably believe
otherwise.

Readers enforce budgets before allocation and decompression. Optional encryption is chunk or envelope scoped with explicit metadata-leakage analysis, key identifiers, rotation, recovery, and revocation. Signatures bind a named revision root and profile, not mutable file bytes unless using a detached publication signature. Cryptographic algorithms are registry-based and agile.

Every sentence above this line describing encryption or signing is a design
intent, not a built or tested mechanism. Treat it as a requirements sketch
for whichever future implementation actually builds this capability.
