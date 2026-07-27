# Public-copy reconciliation required before Arq Language System 4.1 is activated

This is an evidence-led change list, not a request to weaken the product. The
safe alternatives retain the product direction while accurately distinguishing
what the development build demonstrates today from release scope.

| Source                                           | Current risk                                                                                                      | Safe replacement direction                                                                                                                                                            | Claim state                                     | Required evidence before promotion                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `apps/marketing/src/content/home.ts`             | "walls, doors, windows and rooms" plus "opens in your browser" reads as current end-to-end authoring and opening. | Describe Arq as pre-release. Say the development build currently supports its verified plan workflow; identify `.arq` preflight as compatibility-only until the open pipeline exists. | `current-semantic-authoring`, `native-arq-open` | User-reachable open pipeline and browser test.           |
| `apps/marketing/src/content/home.ts`             | "Saving is a local write" collapses journal persistence and portable-file publication.                            | Name the current target: "The development build journals demo-plan edits locally." State the portable `.arq` workflow separately.                                                     | `local-journal-persistence`                     | A tested portable-file write path.                       |
| `apps/marketing/src/content/product.ts`          | Present-tense plan/3D/sheet statements and release tables can be read as current availability.                    | Add a nearby "Release scope, not current availability" label and point users to a verified-current changelog.                                                                         | `3d-current`, `current-import-export-e2e`       | Surface-specific end-to-end tests.                       |
| `apps/marketing/src/content/product.ts`          | Exact format-layer test count is volatile.                                                                        | Remove the number or render it from a CI-produced artifact with provenance.                                                                                                           | `test-counts`                                   | Generated test-evidence file.                            |
| `apps/marketing/src/content/interoperability.ts` | "Every import ... produces an import report" is broader than current product reachability.                        | Say the import-report contract is required for a shipped import flow. Current adapters remain library-level until wired.                                                              | `current-import-export-e2e`                     | Product UI integration test and fidelity report output.  |
| `apps/marketing/src/content/interoperability.ts` | "Nothing round-trips perfectly" is a universal claim.                                                             | Explain Arq's own fidelity categories: preserved, converted, approximated, flattened, omitted, opaque or failed.                                                                      | `lossless-exchange`                             | None. This is a wording correction.                      |
| `apps/marketing/src/content/security.ts`         | "sends nothing anywhere" is an absolute transport/privacy assertion.                                              | Scope the statement to the verified development build and enumerate exceptions or unknowns. Do not use it until network evidence exists.                                              | `no-network-data-transfer`                      | Network-observation test and approved privacy statement. |
| `apps/marketing/src/content/ai.ts`               | "enforced in the project's kernel" can imply a current shipping AI system.                                        | Say the guardrails define the required contract for any future AI capability. Keep "nothing AI-driven is in the development build today."                                             | `current-ai-authoring`                          | A product-enabled AI flow with typed-operation tests.    |
| `apps/marketing/src/content/students.ts`         | "a modest laptop is enough" has no stated benchmark boundary.                                                     | Publish tested browser/device profiles, or say performance is being benchmarked on supported environments.                                                                            | `browser-hardware-minimum`                      | Named environment benchmark evidence.                    |

## Required rendered-site test additions

The public-site suite must render every route and verify these semantic rules:

- a current claim binds to a claim ID with `CURRENT` evidence;
- a planned/release-scope statement includes an explicit scope marker;
- a compatibility result does not contain "opened" or "ready" unless the
  opening state is evidenced;
- "saved" names the persistence target where it could be confused with portable
  file output or sync;
- public statements do not imply universal hardware, lifetime access or data
  transfer guarantees; and
- volatile counts come from generated evidence or are absent.
- every public content file is classified in `public-copy-inventory.json`; and
- review-required editorial patterns have an evidence-backed, time-limited
  acknowledgement or are rewritten.

Use the fragment in `04-wiring/marketing-claim-test.fragment.ts` as the starting
point. Keep existing rendered-page tests. The fragment is additive, not a
replacement for page-specific acceptance tests.

The editorial check does not decide who wrote the copy. It asks whether the
claim is specific, attributable and supported on the page where a reader sees it.
