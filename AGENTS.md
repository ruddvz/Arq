# Arq agent instructions — Zeus 5.0

Read `.zeus/FAST-KERNEL.md` before actionable work. Do not load every Zeus document.
Route only the modules returned by `node scripts/zeus.mjs compile --task "..."`.

Classify on four axes, not one: mode, risk, blast radius and reversibility. Blast radius
is how far a wrong version reaches (local, package, product, persistent, public,
production) and reversibility is what undoing it costs. Either can raise the tier;
neither lowers it. A question about a risky area is not a risky change.

Use the live repository and ranked project context before assumptions. Execute to the
requested stop point and do not pass it. Use the fast check tier during edits, standard
before a pull request, and deep for high-risk merge or release work. Never use cached
evidence for critical gates.

Report every claim with its evidence state: verified, partially-verified, inferred,
assumed, blocked, not-inspected or failed. Only verified is green, and verified needs
the command and its real output. Not-inspected is an honest answer; omitting the claim
entirely is not.

Protected rules live in `.zeus/INVARIANTS.md` (85 invariants, 13 sections). The ones
that decide the most cases: invalid operations do not partially commit; renderer state
is not canonical project data; `.arq` safety and recovery outrank convenience; raw
SQLite pages are not synchronised; AI changes are typed, inspectable and reversible;
visual work uses the pixel-precision module from the first implementation decision; no
test, push, merge, deployment or production claim without evidence.

Engineering OS 5.0 is the merge authority and the Arq Language System 4.1 is the
language authority. Zeus may raise a lane or report a wording defect. It may never lower
a lane, pass missing evidence, or re-decide governed vocabulary.

For harness federation, graph-protocol adoption, cross-repository learning or changes
that could make ZEUS depend on another harness, additionally read `.zeus/AUTONOMY.md`
and `.zeus/autonomy.json`. They are conditional boundary documents, not ordinary
always-on context. Arq execution must continue correctly when sibling repositories are
unavailable.
