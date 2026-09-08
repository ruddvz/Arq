---
name: product-ui-ux
description: Evidence-driven whole-product UI/UX review and implementation method. Use for pages, flows, components, responsive behaviour, accessibility, states, performance UX, interaction, motion, visual hierarchy, design-system consistency, or when asked to critique, simplify, polish, redesign, or verify a product interface. Apple-style craft is a quality bar, never a required aesthetic.
---

# Product UI/UX

Build and review interfaces as working products, not screenshots. The goal is not to make a surface look fashionable. The goal is to make the intended task clear, usable, accessible, responsive, trustworthy, fast, and visually deliberate in the real product.

## 0. Authority and project truth

This skill is a method, not a design system.

Before applying it, load the narrowest authoritative project sources for the surface being changed: product context, current design tokens, component conventions, content rules, accessibility requirements, supported devices, and live implementation. Project rules override generic advice in this skill.

Never make a product "Apple-like" by default. Use Apple's interaction craft as a quality reference for feedback, direct manipulation, spatial consistency, interruptibility, restraint, typography, and motion. Preserve the product's own brand, platform conventions, audience, and information density.

Do not replace a working design system with generic glass, gradients, large radii, system fonts, or floating chrome merely because those patterns appear in another product.

## 1. Choose the mode

Use the smallest mode that matches the request.

- **Audit:** inspect and report. Do not mutate the product.
- **Focused fix:** inspect the affected surface, fix the root problem, then retest it.
- **Flow review:** inspect one end-to-end task across every relevant screen and state.
- **Component review:** inspect one reusable component across variants, states, inputs, and breakpoints.
- **Whole-product review:** inventory routes, flows, components, and design-system primitives, then work in bounded priority batches.

Do not turn a focused request into an unsolicited redesign. Do not call a cosmetic pass a UX audit if the product was never used.

## 2. Reconnaissance before judgement

Do not start with opinions. Establish evidence.

1. Identify the user, their goal, and the product's primary action on the surface.
2. Find the current route, component, styles/tokens, state/data source, and relevant tests.
3. Inspect the rendered product when a browser, preview, screenshot, or running app is available.
4. Walk the task as a user before reading implementation details deeply.
5. Inspect the code after observing the behaviour so the diagnosis is not biased by how the code was intended to work.
6. Compare against project-specific product and design truth, not a generic visual template.
7. Record what was actually inspected and what was not.

A code-only review cannot prove visual quality. A screenshot-only review cannot prove interaction quality. A happy-path clickthrough cannot prove flow quality.

## 3. Fourteen review lenses

Review only the lenses that can change the answer, but a whole-product audit considers all fourteen.

### 3.1 Product purpose and task clarity

- Is the main user goal obvious?
- Does every prominent element help the task, explain the state, or establish necessary trust?
- Is the primary action visually and semantically clear?
- Can unnecessary steps, controls, sections, or copy be removed?
- Does the interface serve the actual product rather than an old roadmap or decorative concept?

### 3.2 Information architecture and wayfinding

Every screen should answer: where am I, what is here, where can I go, and how do I get back or out?

Check navigation labels, hierarchy, route relationships, breadcrumbs where useful, active state, deep links, browser back/forward, refresh, direct entry, and recovery from dead ends.

### 3.3 Core flows and completion

Trace the real task from entry to completion. Count avoidable decisions, duplicated input, hidden prerequisites, accidental exits, unclear commitments, and unrecoverable states. Preserve user input when recovery is reasonable.

### 3.4 Interaction, feedback, and agency

Controls must react immediately enough to feel connected to input. State changes should explain what happened. Destructive or irreversible actions need appropriate friction; ordinary reversible actions usually do not.

Check hover where relevant, focus, pressed, selected, disabled, pending, completion, warning, error, undo, cancel, retry, and interruption.

### 3.5 Visual hierarchy, layout, and density

Judge order, grouping, spacing, alignment, proportion, scan path, whitespace, contrast, and density together. Do not solve weak hierarchy by adding more containers. Similar things should align and behave similarly. Different importance should look different.

### 3.6 Typography, colour, and iconography

Typography is a system of size, weight, line height, measure, tracking, and hierarchy. Large display text can use tighter tracking; small text needs legibility first. Respect text scaling.

Colour must carry semantic intent consistently and cannot be the only signal. Icons need recognisable meaning, optical alignment, adequate hit areas, and accessible names where they act as controls.

### 3.7 Components and design-system consistency

Reuse the project's existing tokens and primitives before creating another version. Audit duplicated buttons, fields, cards, modals, loaders, spacing values, radii, shadows, icons, and state patterns.

Consistency is behavioural as well as visual. Components that look equivalent should not differ in keyboard behaviour, validation, loading semantics, or navigation.

### 3.8 State completeness

For every important component or flow, inspect the states that can actually occur:

- default
- hover, focus, pressed, selected, disabled where applicable
- loading and skeleton
- empty
- partial data
- unusually short and long content
- stale data where relevant
- offline or connectivity failure where relevant
- permission denied or unavailable
- validation error
- server/runtime error
- retry
- cancelled/interrupted
- success
- recovery after failure

Do not invent states the product cannot reach. Do not ignore reachable states because test data is convenient.

### 3.9 Responsive behaviour and device ergonomics

Responsive design is not desktop stacked vertically.

Test representative narrow phone, common phone, large phone, tablet, laptop, desktop, and large desktop widths when the product supports them. Include portrait/landscape when orientation matters. Check 200% browser zoom or equivalent text enlargement for web interfaces.

Look for clipped content, hidden actions, unsafe fixed positioning, viewport-height traps, awkward line lengths, overflow, excessive empty space, touch controls too close together, keyboard overlap, safe-area issues, and components that change reading order incorrectly.

### 3.10 Accessibility and input modalities

WCAG 2.2 AA is the minimum web baseline unless the project defines a stricter standard.

Check:

- semantic structure and landmarks
- keyboard reachability and logical order
- visible focus and focus not obscured by sticky/floating UI
- correct focus placement and restoration for dialogs, sheets, menus, and route-like transitions
- accessible names, roles, values, descriptions, and label association
- errors identified in text and connected to the affected input
- dynamic state announcements where a page reload does not communicate the change
- colour contrast and non-colour cues
- reflow and text enlargement
- alternatives to dragging when dragging is not essential
- touch/pointer targets that meet WCAG 2.2 minimum target-size rules and are comfortably sized for the platform
- reduced-motion alternatives
- media captions/transcripts when relevant
- screen-reader reading order and hidden decorative content

Do not blindly enforce a 44px control on every desktop interface. WCAG 2.2 Target Size (Minimum) uses 24 by 24 CSS pixels with defined exceptions. Platform guidance may call for larger comfortable targets. Use the stricter project/platform requirement where applicable.

### 3.11 Content and comprehension

Interface copy is part of UX. Prefer specific labels over vague umbrellas. Explain consequences at the moment a user needs them. Error messages should say what happened and what the user can do next. Do not use helper text to compensate for a confusing control if the control can be made clearer.

Project language and factual rules outrank generic copy advice.

### 3.12 Performance and perceived performance

A responsive-looking interface that blocks input is not responsive.

For web products, treat current Core Web Vitals good thresholds as a baseline unless the project sets stricter targets: LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1 at the 75th percentile.

Inspect avoidable main-thread work, delayed interaction handlers, layout shifts, oversized media, font/layout jumps, unnecessary hydration, blocking overlays, fake minimum spinner delays, eager off-screen work, repeated network requests, and loading states that hide progress rather than explain it.

Do not claim field performance from a local Lighthouse run. Lab and field evidence are different.

### 3.13 Motion and physical interaction

Use motion to preserve continuity, causality, hierarchy, or orientation. Decorative movement must earn its cost.

For gesture-driven UI:

- respond on press/pointer-down when safe so feedback is immediate
- track direct manipulation 1:1 and respect the user's grab offset
- keep gesture animations interruptible and redirectable
- animate from the current presented value, not a stale target
- hand off release velocity into the continuation when the interaction carries momentum
- project momentum before selecting a snap target when that matches the control's physics
- use springs for touchable/interruptible physical behaviour rather than fixed keyframes where interruption matters
- preserve spatial consistency: enter and exit through coherent paths and anchor overlays to their source
- use progressive resistance at boundaries rather than a dead hard stop when the interaction metaphor benefits from it
- prefer compositor-friendly transform and opacity for frequent motion
- provide a reduced-motion equivalent that keeps feedback without vestibular movement

Critically damped motion with little or no overshoot is a strong default for ordinary UI. Bounce belongs to interactions whose gesture or object metaphor justifies momentum. Do not add bounce to make an interface feel "premium".

Glass, blur, translucency, haptics, sound, and scroll effects are optional techniques, not quality requirements. Use them only when hierarchy, causality, or platform context improves.

### 3.14 Trust, privacy, safety, and reversibility

Where the product handles money, identity, health, personal data, destructive actions, AI output, uploads, or irreversible changes, UI quality includes truthful consequences, appropriate consent, clear provenance, privacy boundaries, recovery, and safe defaults.

Never trade correctness or safety for a cleaner screenshot.

## 4. Anti-pattern filter: reject generic AI UI

Actively challenge these patterns when they are not justified by the product:

- cards nested inside cards
- excessive pills, badges, and chips
- rounded containers around every block
- gradients or glass used as decoration rather than hierarchy
- giant hero copy that delays the actual task
- decorative icons with no information value
- every section receiving equal visual weight
- repetitive three-column marketing sections
- excessive shadows and floating surfaces
- animations on every state change
- fake dashboards or fabricated data added to make a screen look complete
- verbose explanatory copy beside self-explanatory controls
- duplicated CTAs for the same action
- unnecessary tabs, carousels, accordions, or modals
- mobile layouts that are merely desktop sections stacked in the same order
- placeholder metrics, reviews, prices, names, claims, or social proof

The reviewer is authorised to recommend removal. Simplicity is often subtractive.

## 5. Apple-quality interaction principles, not Apple styling

Use these principles when they fit the product:

1. **Purpose:** every element earns attention.
2. **Agency:** users remain in control and can recover from ordinary mistakes.
3. **Responsibility:** privacy, safety, and truthful consequences beat convenience.
4. **Familiarity:** follow learned platform patterns unless evidence supports a better one.
5. **Flexibility:** work across abilities, devices, input types, and expertise.
6. **Simplicity:** reduce unnecessary choices while preserving needed context.
7. **Craft:** spacing, type, icon alignment, states, and motion are intentional.
8. **Delight:** emerges from the first seven. It is not confetti, glass, or bounce added afterward.

## 6. Evidence standard for findings

Do not write findings such as "spacing could be better" or "make this more modern".

Every actionable finding should include:

- **ID**
- **Severity**
- **Lens**
- **Surface/route/component**
- **Observed problem**
- **Evidence**: browser state, screenshot, device/viewport, DOM/accessibility evidence, metric, test, and/or file:line when available
- **User impact**
- **Root cause or best current diagnosis**
- **Recommendation** that reuses project truth
- **Acceptance check**
- **Effort**: XS, S, M, or L when useful

Severity:

- **P0:** core task blocked, severe safety/privacy/data-loss risk, or interface inaccessible to a critical user path
- **P1:** major task failure, widespread accessibility/responsive defect, or high-frequency severe friction
- **P2:** meaningful friction, inconsistency, state gap, or maintainability problem
- **P3:** craft improvement with limited task impact

Do not inflate cosmetic defects into P0/P1. Do not bury a task blocker among polish notes.

Prioritise by user impact, confidence in the diagnosis, recurrence, and effort. Avoid fake numerical precision when evidence is qualitative.

## 7. Audit workflow

### Pass A: inventory

Map the relevant routes, flows, components, tokens, breakpoints, state sources, and tests. For whole-product work, identify the few primary tasks first.

### Pass B: use the product

Walk the real task. Capture failures and friction before changing anything. Use realistic data where permitted. Never fabricate product data just to fill a state.

### Pass C: edge and accessibility sweep

Exercise keyboard, focus, zoom/text enlargement, narrow width, loading, empty, error, long content, retry, and reduced motion. Add screen-reader/manual semantic checks where the tooling and scope allow.

### Pass D: implementation diagnosis

Trace each important observed problem to the smallest responsible contract: information architecture, state model, component API, styling/token use, data timing, content, routing, or event handling.

### Pass E: prioritise

Group duplicate symptoms under root causes. Put task blockers and systemic defects before cosmetic inconsistencies.

### Pass F: implement when authorised

Fix the smallest complete root cause. Reuse primitives and tokens. Remove obsolete paths rather than layering a third implementation on top. Do not broaden the lane silently.

### Pass G: retest

Re-run the exact state, viewport, input mode, and flow that exposed the problem, plus the closest regression surface. Static checks alone do not prove a visual/interaction change.

### Pass H: critique the result

Ask what the change made worse: density, legibility, task length, accessibility, performance, consistency, brand, or maintainability. Fix material regressions and retest.

## 8. Review matrix for a changed component

At minimum, ask:

| Dimension | Questions |
| --- | --- |
| Purpose | What user task does it serve? Is it still needed? |
| Content | Short, long, missing, localised, unexpected? |
| Interaction | Pointer, touch, keyboard, focus, disabled, pending? |
| State | Loading, empty, error, retry, success, unavailable? |
| Responsive | Narrow, medium, wide, zoom/text enlargement? |
| Accessibility | Name, role, value, labels, order, focus, announcement, contrast? |
| Performance | Does interaction block, jump, reflow, or load unnecessary work? |
| Motion | Necessary, spatially coherent, interruptible where needed, reduced-motion safe? |
| System | Existing token/component reused? Any duplicate primitive introduced? |
| Recovery | Can the user undo, cancel, retry, or return safely? |

## 9. Completion rules

Do not call a UI/UX task complete because the code compiles or a screenshot looks good.

For the requested scope, completion means:

- the intended user task is clear and works in the inspected path
- reachable high-priority states were checked
- responsive behaviour was checked at relevant widths
- keyboard/focus/accessibility implications were checked
- project tokens and primitives remain coherent
- relevant automated checks ran when available
- visual/interaction behaviour was manually or browser-verified when tooling permits
- known P0/P1 regressions are fixed or explicitly blocked
- remaining P2/P3 work is stated rather than hidden
- claims about tests, metrics, devices, or production are backed by actual evidence

Never report "perfect". Report verified, partially verified, blocked, or not inspected as appropriate.

## 10. Upstream acknowledgement

The motion and interaction craft in this skill is informed by and partly adapted from Emil Kowalski's `apple-design` skill in `emilkowalski/skills`, which is distributed under the MIT License.

MIT License

Copyright (c) 2026 Emil Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
