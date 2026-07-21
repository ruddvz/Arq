# Product plan

This builds on `PAIN_POINTS.md` (what's wrong with the incumbents) and
`ARCHITECTURE.md` (the technical foundation: OpenCASCADE kernel, BIM object model,
AI operation layer, DXF/IFC interop). This doc answers: who we build for first, which
platform we build first, what the product actually does, and in what order.

## Positioning

Arq is a **native, Apple-first BIM authoring tool** built around a capability no
incumbent has: going from a LiDAR scan or a sketch/text description straight to
editable, parametric building geometry, on the same device, with real-time
collaboration and honest pricing. Not "AutoCAD but cheaper" — "the tool for the
architect who currently can't afford, can't run, or is fighting the software they're
supposed to be using."

## Who we build for first

Not enterprise firms already deep in Revit workflows — they're the hardest sell (sunk
cost, IT policy, need every enterprise feature on day one) and the least annoyed by
price. First target:

- **Solo architects, small firms (1–10 people), and architecture students** — the
  group `PAIN_POINTS.md` shows is most price-sensitive, most likely to already own
  Apple hardware, and most willing to adopt something new if it removes real friction
  (LiDAR capture, Mac support, real-time collaboration without IT setup).
- Secondary, later: small-to-mid firms currently splitting between Mac (design) and a
  Windows machine/VM (Revit) just to produce documents — Arq removing the VM is a
  direct win for them without needing every enterprise feature first.

## Platform strategy — the direct answer

**Build the iOS/iPadOS app first. Yes, also build a website — but as a companion, not
the primary authoring surface, and not simultaneously as a full competing product.**
Reasoning:

1. **LiDAR is the wedge, and it's hardware-gated.** The single clearest differentiator
   in `PAIN_POINTS.md` (#7 — capture-to-BIM with no export/re-import round trip) only
   exists as a *native app* with camera/LiDAR access. A website cannot do this. This
   alone settles "app first."
2. **The underserved audience is already on Apple hardware.** Mac has zero Revit
   support (`PAIN_POINTS.md` #2) — the people most annoyed by that are, by definition,
   people already holding an iPhone or iPad. Meeting them on iOS is meeting them where
   the pain already is.
3. **Apple Pencil on iPad is a real input advantage**, not a gimmick — architects sketch
   by hand; a tool that takes a sketch and a LiDAR scan as native, first-class inputs
   (rather than "import an image") is a different authoring experience than anything
   in `RESEARCH.md`'s survey.
4. **iOS-first is also the cheapest path to macOS second.** If the app is built in
   Swift/SwiftUI, a Mac build (Catalyst, or a native SwiftUI multiplatform target) is a
   comparatively small delta later — which directly serves the "then macOS" part of
   the roadmap you asked about, rather than starting over on a second stack.
5. **The honest tradeoff:** a website has real advantages an app doesn't — zero-install
   trial/demo funnel, easiest thing to market and link to, and it's the only way to
   reach Windows users (still the majority of the industry) without waiting for a
   Windows app. So: ship a **lightweight companion website in parallel** — marketing
   site, model viewer/share links (send a client or a Windows-using collaborator a
   link, no install), and account/billing — while the iOS app is the only place actual
   authoring happens. A full browser-based authoring surface (Figma-style canvas in
   the browser) is a legitimate long-term platform, but it's a second, later bet, not
   part of v1 — building real-time collaborative authoring twice (native + web)
   simultaneously would split effort exactly when focus matters most.

### Recommended platform order

| Order | Platform | Role |
|---|---|---|
| 1 | **iOS / iPadOS** (universal app) | Primary authoring surface: capture, sketch, model, collaborate |
| 1 (parallel, thin) | **Website** | Marketing, account/billing, read-only model viewer + share links — not authoring |
| 2 | **macOS** | Native port (Catalyst or SwiftUI multiplatform) once iOS core is proven — desktop-scale authoring for heavier project work |
| 3 | **Windows** | Biggest lift (no Swift/SwiftUI story) — evaluate web-based authoring (reuse the viewer, extend to editing) vs. a native rewrite once there's revenue to justify it |
| 4 (maybe) | **Android** | Only if field-capture demand justifies it — LiDAR hardware parity across Android devices is inconsistent, so the wedge feature is weaker there |
| — | **Apple Vision Pro** | Not a platform to ship on its own — a later mode of the iOS/macOS app (walk a model at full scale). Flagged in Tier 3 below. |

## Feature plan, by tier

Every tier ties back to a specific pain point so this stays "solving known problems,"
not feature accumulation for its own sake.

### Tier 0 — MVP / the wedge

The smallest version that is genuinely useful and does something no incumbent does.

- **LiDAR/AR room capture → editable geometry.** Scan a room or building on
  iPhone/iPad Pro; auto-generate walls, openings, and floor geometry as real
  parametric BIM objects (not a dumb point cloud/mesh) — directly answers
  `PAIN_POINTS.md` #7.
- **Core 2D + 3D drafting**: walls, doors, windows, dimensions, levels — with Apple
  Pencil support on iPad for hand-sketched input.
- **AI-assisted authoring**: natural-language or sketch input drives the same
  "building operations" vocabulary from `ARCHITECTURE.md` (add_wall, cut_opening,
  etc.), so typing "add a 3m x 4m bedroom off this hallway" is a real input method,
  not a gimmick layered on top.
- **DXF/DWG and IFC import/export**, tested continuously — this is what makes the app
  usable on a real project from week one, per `PAIN_POINTS.md` #8.
- **Offline-first.** Job sites don't have reliable signal; local-first data with sync
  when connectivity returns is a requirement, not a stretch goal.
- **A single "why is this the way it is" inspector** for any element — geometry,
  visibility, and parametric relationships in one place, directly answering
  `PAIN_POINTS.md` #3 and #4.

### Tier 1 — Collaboration and differentiation

- **Real-time multiplayer editing** (live cursors/presence, like Figma) instead of a
  central-model-and-worksets pattern — answers `PAIN_POINTS.md` #6. This needs to be
  designed into the data layer from Tier 0, not retrofitted.
- **Element-anchored comments/redlining** for client and consultant feedback.
- **Non-destructive version history** ("time travel" through a project's edits).
- **In-place AR walkthrough** — stand in the actual (or a nearby) space and see the
  proposed design overlaid, using the same device that did the capture.

### Tier 2 — Professional depth

- **Schedules and quantities** (door/window/room schedules, area calculations) — the
  functionality that makes a tool usable for real construction documents, not just
  concept design.
- **Built-in visualization good enough for client presentation**, so a third paid
  renderer isn't mandatory — answers `PAIN_POINTS.md` #10.
- **Extensibility/plugin model** for custom families/components — long-term, only
  once there's a stable object model worth extending.
- **Code/zoning compliance flags** — genuinely valuable but jurisdiction-dependent and
  research-heavy; scope only after talking to real users about which checks matter
  most, don't build speculatively.

### Tier 3 — Later / moonshot

- **Apple Vision Pro full-scale walkthroughs** of a model.
- **Construction-phase features** (punch lists, RFIs) bridging into general
  contractor workflows — a different user (contractor, not architect) and a
  deliberate, later expansion of scope.

## Roadmap (maps onto `ARCHITECTURE.md`'s phases 0–5)

| Phase | Deliverable |
|---|---|
| 0 | Research + architecture direction (done — `RESEARCH.md`, `ARCHITECTURE.md`) |
| 0.5 (this doc) | Product plan, pain-point grounding, design system direction |
| 1 | Kernel + BIM object model, scripted only, validated against Tier 0 feature list |
| 2 | iOS app skeleton: capture → geometry pipeline proven end-to-end for a single room |
| 3 | Core drafting + AI operation layer on iOS; DXF/IFC export validated in an external viewer |
| 4 | Companion website (viewer/share/account) live in parallel |
| 5 | Real-time multiplayer (Tier 1) on iOS |
| 6+ | macOS port; Tier 2 depth; Windows platform decision |

## Business model (flagged, not decided here)

Price is `PAIN_POINTS.md`'s #1 complaint, so pricing needs to be a deliberate choice,
not a default. Worth deciding explicitly (not resolved in this doc): a generous free
tier for students/hobbyists, and a paid tier priced for a solo practitioner's budget
rather than a firm's IT line item. This is a business decision for you to make, not
one to bake in silently.

## Risks / open questions to keep visible

- **App Store review risk**: "professional CAD tool" isn't a standard App Store
  category pattern; subscription billing through Apple's IAP also means a 15–30% cut
  of revenue — worth understanding before pricing is finalized.
- **Real-time multiplayer is a hard distributed-systems problem** (CRDT/OT-style
  sync for parametric geometry, not just text) — treat as a real Tier 1 engineering
  investment, not a checkbox.
- **LiDAR accuracy (~1–2cm) is good for design/renovation planning but likely not a
  legal/surveying-grade as-built** — be explicit with users about what the capture is
  and isn't good for.
- **Tier 2's schedules/quantities/code-compliance features are, on their own, a
  multi-year investment** in real BIM software — sequence them deliberately rather
  than promising them early.
