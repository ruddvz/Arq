# Language contract compatibility

The language system is a versioned consumer contract. A support bot, product AI,
documentation build or UI message resolver must declare the highest contract
version it understands before consuming a generated context.

## Change classes

- **Patch:** wording clarification that preserves IDs, states, slots and meaning.
- **Minor:** additive message IDs, aliases, non-breaking fields or an additional
  answer disposition.
- **Major:** removed/renamed canonical IDs, changed state meaning, changed
  required variables, changed source precedence or an answerability outcome.

## Compatibility rules

1. Canonical IDs are immutable within a major version.
2. A deprecated ID remains resolvable with a replacement ID and sunset rule.
3. Consumers must reject a context with a higher unsupported major version.
4. Consumers may ignore unknown additive fields only when the schema marks them
   optional.
5. A change to a `CURRENT`, `CONFLICTED`, `PROHIBITED` or persistence-related
   assertion requires a claim-impact review and regenerated context.

The machine-readable declaration is
`02-canonical/language-contract-version.json`.
