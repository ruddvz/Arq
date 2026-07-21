# What architects actually complain about

> **Folded into the master plan.** [`docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md`](product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md)
> §4 converts the same class of complaints directly into testable requirements. Kept
> here as background/citations for the pricing, no-Mac-support, and LiDAR-capture
> points not repeated verbatim there.

Before locking in features, this is a survey of recurring complaints about the
incumbent tools (Revit, AutoCAD, ArchiCAD, SketchUp) — pulled from Capterra/G2 review
themes, Autodesk's own community forums, AEC trade press, and small-firm/student
discussions of alternatives. Direct Reddit threads were largely unindexed/inaccessible
to search, so this leans on the sources above; treat the specific numbers as
representative, not exact quotes. Each item ends with the Arq opportunity it implies.

## 1. Price is the #1 barrier for solo architects and small firms

Revit runs ~~$365/month or ~$2,910–8,730/year depending on term; AutoCAD is
similarly priced (~~$250/month). These are subscription-only — no perpetual license
option anymore. This pushes students, solo practitioners, and small firms toward free
tools (FreeCAD, LibreCAD, QCAD, BricsCAD) that are functional but clearly "the budget
option," not tools people choose because they're better.

→ **Opportunity:** the segment most annoyed by price is exactly the segment an indie,
mobile-first product can reach first (see Product Plan → target users). Pricing itself
is a business decision, not solved here, but "affordable enough that a solo architect
doesn't flinch" should be a design constraint from day one, not an afterthought.

## 2. Revit has zero Mac support — by design, not by gap

Revit is built on .NET and DirectX, both Windows-native, and Autodesk has told users
directly there's no plan to change that. Mac-using architects either run Windows in a
VM (Parallels), rent a cloud PC, or don't use Revit. One architect paying ~$400/month
described feeling "thrown under the bus." AutoCAD does ship a Mac version, but it's
widely regarded as the second-class sibling of the Windows build.

→ **Opportunity:** this is a structural gap, not a UX complaint — an entire hardware
ecosystem (every Mac/iPad-using architect) is unserved by the category leader. Building
natively for Apple platforms first isn't just a stylistic choice, it's walking into an
underserved market on day one.

## 3. Steep learning curve, and BIM's complexity has a long tail

Firms report the 2D-to-BIM transition taking years, not weeks. Recurring specific
frustrations: dense/cluttered menus, unintuitive graphics, and troubleshooting rituals
that shouldn't exist — e.g. "object not visible in view" can mean checking view range,
view templates, view filters, workset visibility, or temporary hide/isolate, one at a
time, with no single place that tells you why something is invisible.

→ **Opportunity:** any "why can't I see/edit this" state should be diagnosable from a
single inspection panel, not a five-step mental checklist. This is a concrete,
buildable UX requirement, not just a "be simpler" aspiration.

## 4. Parametric behavior is brittle and hard to override

Automatic behaviors — wall joins in particular — sometimes produce results that aren't
physically possible or are difficult to force back to what the user actually wants.
Family/component behavior can be inconsistent across views (e.g. contradicts itself in
3D vs. plan for the same thin-sheet-metal element). Editing one thing unexpectedly
breaks something else elsewhere in the model.

→ **Opportunity:** parametric relationships need to be inspectable and overridable —
a user should always be able to see _why_ the software did something and pin an
explicit override, rather than fight the automation.

## 5. Performance and stability degrade as models grow

Large/complex projects bring slowdowns, occasional crashes, and glitches that interrupt
work. This is a known tradeoff of monolithic desktop BIM tools carrying decades of
feature accretion.

→ **Opportunity:** a modern geometry kernel + a data model designed for incremental
computation (only recompute what changed) should be a hard requirement, not a
performance nice-to-have bolted on later.

## 6. Collaboration is central-model plumbing, not real-time multiplayer

Revit's worksharing model (central model + worksets + local syncs) requires real setup
and maintenance, and doesn't feel like the real-time, cursor-visible collaboration
people now expect from tools like Figma or Google Docs. Conflicts and sync friction are
a known cost of the architecture, not an edge case.

→ **Opportunity:** design collaboration as real-time-first (CRDT/operational-transform
style) from the start, rather than retrofitting live collaboration onto a
file-locking model later — this is far harder to bolt on after the fact than to build
in from v1.

## 7. Field work and the office model are disconnected

On-site capture (measuring existing conditions, as-built documentation) increasingly
happens on iPhone/iPad via LiDAR-based apps like SiteScape or Metaroom — accurate to
roughly 1–2 cm per wall, a 500 m² floor scannable in minutes. But that data then has to
be exported and re-imported into Revit/AutoCAD/ArchiCAD/SketchUp as a separate step,
losing fidelity and adding friction. No mainstream authoring tool does capture _and_
authoring in one app.

→ **Opportunity:** this is the single clearest wedge feature available. An iOS/iPadOS
app that scans a room with LiDAR and turns it directly into editable BIM geometry — no
export/re-import round trip — is something none of the four incumbents can do, because
none of them are native mobile apps with camera/LiDAR access.

## 8. File interop between tools loses data

Moving drawings between AutoCAD, Revit, ArchiCAD, and SketchUp via DWG/IFC is workable
but imperfect — geometry or metadata gets lost or mangled often enough that it's a
known, named pain point across the category (part of why LibreCAD's DXF/DWG library
and FreeCAD's IFC support are called out specifically as useful, not assumed to "just
work" generically).

→ **Opportunity:** Arq must treat DWG and IFC import/export as a first-class,
continuously-tested feature — not a checkbox — because it's the only way to be usable
on a real project that also involves people still on the incumbent tools (which will be
true for a long time).

## 9. The UI itself looks and feels dated

Toolbars, ribbons, and dialog-heavy workflows carry decades of accumulated convention
that reviewers describe as unintuitive, and which compounds the learning-curve problem
above — it's not just that BIM is conceptually hard, it's that the interface doesn't
help.

→ **Opportunity:** this is the direct rationale for investing real effort in a
deliberate, restrained visual design (see `DESIGN_SYSTEM.md`) instead of treating UI
polish as a late-stage coat of paint.

## 10. Built-in rendering isn't good enough for client presentation

Firms commonly pay for and learn a separate renderer (Enscape, Lumion, V-Ray) because
native visualization doesn't produce presentation-ready output. That's a second tool,
a second license, and a second learning curve stacked on top of the primary one.

→ **Opportunity:** worth scoping good-enough built-in visualization (even if not
competitive with dedicated path-tracers at launch) so a solo architect isn't forced
into a third piece of paid software just to show a client what a space looks like.

## Summary table

| Pain point              | Root cause                                  | Arq response                                 |
| ----------------------- | ------------------------------------------- | -------------------------------------------- |
| Cost                    | Subscription pricing, no perpetual option   | Accessible pricing as a design constraint    |
| No Mac/mobile           | Windows-only native code                    | Apple-native from day one                    |
| Learning curve          | Accumulated UI complexity                   | Single-panel "why" inspection, restrained UI |
| Brittle parametrics     | Opaque automatic behavior                   | Inspectable, overridable relationships       |
| Performance             | Legacy architecture at scale                | Modern kernel, incremental recompute         |
| Collaboration friction  | File-locking worksharing model              | Real-time multiplayer from v1                |
| Field/office gap        | No capture-to-BIM tool exists               | Native LiDAR capture → editable model        |
| Interop loss            | DWG/IFC treated as an afterthought          | First-class, tested import/export            |
| Dated UI                | Decades of convention                       | Deliberate monochrome design system          |
| Weak built-in rendering | Visualization is out of scope for BIM tools | Good-enough built-in visualization           |
