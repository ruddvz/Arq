# Public-page evidence standard

Every file under `apps/marketing/src/content` must appear in
`02-canonical/public-copy-inventory.json`.

The inventory must also reconcile with `docs/pages/ROUTE-MAP.csv` and
`apps/marketing/src/routes.ts`. A public page is not governed until its source
module, route-map record, typed registry entry and output route agree.

## Classification

Use `claim-bearing` when the file makes a current, planned, capability, pricing,
privacy, file, AI, support or scope assertion. Bind each assertion to the claim
registry. Use `non-claim` only when the file has no governed product assertion,
and give a short reason.

The inventory is not a substitute for page review. It is the list that makes
page review complete.

## Page review

Before merging a public page change:

1. Check each changed assertion against its claim state and evidence source.
2. Confirm a limitation is visible next to a claim that needs one.
3. Read headlines, cards, snippets and callouts on their own. They must not
   imply a stronger capability than the surrounding page proves.
4. Run the public-copy inventory and editorial-policy checks.
5. Build the static site and run the rendered public-site checker. It checks
   every generated route, including titles and entity-decoded content.
6. Review the rendered page at narrow and wide widths, keyboard only and with
   the accessibility tree. Do not hide a qualification in a tooltip or image.

## Release review

At release, re-review every page triggered by a changed claim state, source set,
format matrix, file flow, AI boundary, privacy policy, supported environment or
pricing decision. A content file that is added or renamed without an inventory
record fails the repository gate.

For a GitHub Pages deployment, write a route-hash proof into the static artifact
after the build. After deployment, verify the public response hashes and commit
against that proof. Do not call a release compliant before the post-deploy check
passes.

## Evidence wording

Use a source to constrain language, not to pad copy. Good copy names the
behaviour and the limit. A source link belongs where readers need to inspect the
evidence, not as a substitute for a precise statement.
