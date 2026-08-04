# Deployed public-site standard

Public copy is not compliant merely because its source module is reviewed. A
visitor receives generated HTML from a deployed revision. ARQ therefore checks
three different facts.

1. The authored source uses canonical terms and passes hard language rules.
2. The static build contains every approved public route and passes the same
   hard rules after templates and HTML entities are applied.
3. The deployed response matches a proof written from that exact build and
   commit.

## U+2014 rule

Public and product UI copy must not contain U+2014. Use a full stop, colon,
parentheses, semicolon, or a shorter direct sentence. This is a house-style
constraint for clear, restrained ARQ copy. It does not infer authorship and it
must not be represented as a detector result.

The rule applies to visible text, headings, titles, summaries and attribute
content that reaches a person. A source comment is not public copy, but the
rendered-site audit is authoritative for the delivered page.

## Static artifact proof

After the marketing build, run the rendered-site verifier with `--write-proof`
and the deployment commit SHA. It writes `arq-language-site-proof.json` into
the artifact. The proof lists every public route and the SHA-256 digest of its
exact HTML.

Do not hand-edit the proof, regenerate it from a different checkout, or omit it
from the Pages artifact. Those actions break the source-to-build-to-live chain.

## Post-deploy verification

The deployment workflow must expose the URL emitted by `actions/deploy-pages`.
The verification job fetches the proof and every route with caching disabled. It
fails if the proof commit is not the deployment commit, if a route hash differs,
if a route is unavailable, or if rendered public copy breaks a hard language
rule.

The static and live checks also reject externally loaded scripts, styles,
images, fonts, frames and CSS URLs. This does not prove every privacy property,
but it makes the public site's no-third-party-resource statement inspectable at
the artifact boundary.

Retries are allowed only for normal GitHub Pages propagation. A retry does not
turn a mismatched commit into a pass.

## Review-required patterns

The build proof does not replace human review. Review-required patterns are
handled against the source file and its temporary evidence-backed
acknowledgement. Rendered HTML is the final hard-rule boundary because templates
and entity encoding can introduce text absent from the source module.
