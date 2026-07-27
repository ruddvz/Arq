# Public-copy remediation catalogue for the current GitHub Pages site

This is an implementation-ready review list for the inspected revision
`claude/arq-cad-platform-research-ba8rav`. It is deliberately more conservative
than a copy polish. Do not apply a replacement that promotes a claim beyond its
binding state.

The mechanical rule is simple: every public-content U+2014 occurrence must be
rewritten before merge. The semantic rule is stricter: use the replacement only
when its cited claim state remains true at the revision being deployed.

## Required replacements by page

| Route                | Replace the current framing with                                                                                                                                                                                                       | Required claim treatment                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | "Arq is pre-release architectural software. The current development build supports its verified plan workflow and journals demo-plan edits locally."                                                                                   | Name the local journal. State that `.arq` selection currently establishes compatibility and does not yet open a working browser project. Do not describe doors, windows or rooms as a wired current workflow. |
| `/product`           | "Release scope describes the intended product sequence. It is not a statement that every listed workflow is available in the current development build."                                                                               | Remove the test count. Keep 3D current state qualified until the conflict is resolved.                                                                                                                        |
| `/architects`        | "Arq is being developed for residential work and small practices. The current development build and release scope are documented separately."                                                                                          | Remove the lifetime access promise. Do not state door or dimension consistency as a current end-to-end guarantee without surface evidence.                                                                    |
| `/students`          | "Arq runs in a browser. The project has not yet published a minimum hardware profile."                                                                                                                                                 | Remove the modest-laptop assertion. Treat semantic opening and room workflows as release scope unless reachability is proven.                                                                                 |
| `/collaboration`     | "Sharing, comments, issues and revision comparison are planned in release scope. The current build has no sharing backend."                                                                                                            | Keep all planned labels visible. Do not use a designed data model as proof of a current collaboration feature.                                                                                                |
| `/ai`                | "Any future AI capability must show a proposal before it changes a project. The proposal records intent, assumptions, operations, preview, validation and undo. No AI-driven authoring is available in the current development build." | Replace metaphor and claimed current enforcement with the future contract.                                                                                                                                    |
| `/interoperability`  | "The repository contains tested format adapters. A user-reachable import or export workflow is not established until its product surface and report are tested end to end."                                                            | Replace universal round-trip language with Arq's fidelity terms: Preserved, Converted, Approximated, Flattened, Omitted, Unsupported, Opaque and Failed. Remove ungenerated test counts.                      |
| `/ipad`              | "The browser build has a tested touch layout. Native Files, Pencil, RoomPlan and LiDAR work are planned and capability-gated."                                                                                                         | Do not state that the same project file opens on both devices.                                                                                                                                                |
| `/pricing`           | "Pricing is not set. The development build is currently available without a paid plan."                                                                                                                                                | Remove lifetime archive access and character claims about honesty. Keep future commercial terms as undecided.                                                                                                 |
| `/security`          | "Before publishing a transport claim, Arq requires current network-observation evidence and approved privacy wording."                                                                                                                 | Remove absolute statements that project data is sent nowhere. Keep the current security baseline and future-hosting boundary separate.                                                                        |
| `/docs`              | "Technical documentation is available in the reviewed repository revision. A hosted help centre is planned, not current."                                                                                                              | Remove volatile documentation totals or link an artifact that generates them.                                                                                                                                 |
| `/changelog`         | "Each entry links to its reviewed commit, test artifact or release evidence. A changelog entry cannot settle an active conflict."                                                                                                      | Rewrite 3D, file-opening and persistence entries until they match their bindings. Replace the `175 tests` summary with a generated evidence link or omit it.                                                  |
| `/status`            | "No hosted Arq service is currently documented. The public site is deployed as static files."                                                                                                                                          | Remove any statement that an Arq outage can never affect a reader. Service status is volatile and must pass post-deploy verification.                                                                         |
| `/contact`           | "For product questions, open a repository issue. For a vulnerability, use the repository's private security advisory process."                                                                                                         | Do not call channels real or staffed. State no response-time commitment unless one is approved.                                                                                                               |
| `/legal/privacy`     | "A formal privacy notice has not yet been published. This page may state only build-verified current practices and must link the approved notice when one exists."                                                                     | Do not present a complete privacy posture until resource, telemetry and legal-policy evidence are current.                                                                                                    |
| `/legal/terms`       | "No final public product terms are published. Formal terms require legal review before a paid plan or hosted service."                                                                                                                 | Do not present provisional copy as approved legal terms or promise future terms content.                                                                                                                      |
| `/legal/open-source` | "This notice set is generated from the dependency evidence for this deployed artifact."                                                                                                                                                | The page must be generated with the artifact proof and not hand-maintained.                                                                                                                                   |
| `/404`               | "This address does not match a page on this site. Nothing in your project was changed."                                                                                                                                                | Keep it non-product-specific. Remove U+2014 from its title and recovery text.                                                                                                                                 |

## Literal sentence patterns to remove

Remove or rewrite these patterns wherever they appear in public source:

- U+2014 in headings, descriptions, body copy, title text and templates.
- "honest", "honestly", "genuinely", "real" or "not pretending" used as
  evidence substitutes.
- "that would be a lie" and other combative negative contrast.
- "tests behind every entry", "several hundred tests" and other broad,
  unlinked verification statements.
- "sends nothing anywhere", "will always open", "can never lock you out" and
  other absolute privacy or lifetime guarantees.
- "opens in your browser" when the source only proves compatibility preflight.
- present-tense 3D, import/export, door/window/room or AI claims that are bound
  to `CONFLICTED`, `LIBRARY_ONLY` or `PLANNED` states.

## Required implementation sequence

1. Update the affected `apps/marketing/src/content/*.ts` module.
2. Update its claim binding if the wording changes scope or state.
3. Run `pnpm arq:language:public:verify` and
   `pnpm arq:language:routes:verify`.
4. Run `pnpm arq:language:audit:ci`. Do not add an acknowledgement for a hard
   U+2014 finding.
5. Build the site and run `pnpm arq:language:site:build:verify`.
6. Deploy with the proof artifact and run
   `pnpm arq:language:site:live:verify` against the Pages URL.

The remedial copy should be written by the responsible page owner and reviewed
against the fresh source digest. This catalogue intentionally does not make a
marketing rewrite stand in for resolution of the recorded product conflicts.
