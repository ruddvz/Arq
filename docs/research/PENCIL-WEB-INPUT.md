# Pencil web input (ARQ-171)

## Purpose

Blueprint section 13 ("iPad shell")'s "Input roles" assigns distinct
interaction rules to Apple Pencil, Finger, and Keyboard/trackpad, and
requires "Web support must use capability detection. It must not assume
native Pencil APIs." This tests exactly that: the standard W3C Pointer
Events API's ability to distinguish Pencil from finger from mouse/
trackpad, and to support hover preview - the one web-detectable mechanism
section 13's "Pencil hover preview" and section 108's "Apple Pencil hover"
depend on.

## What this is, and what it is not

**No physical iPad or Apple Pencil hardware exists in this sandboxed
environment.** Nothing here was tested on a real device, and no claim
below should be read as an on-device Safari/Pencil result. Two separate
things were verified instead, both real:

1. **This repository's own role-classification logic**
   (`packages/input-system/src/pointer-role.ts`) - pure, DOM-free unit
   tests (12/12 passing), no browser needed.
2. **The real W3C Pointer Events API's behaviour in an actual browser
   engine** (headless Chromium via Playwright, the same real-browser
   discipline `canvas-2d-benchmark.html`/`run-canvas-2d-benchmark.mjs`
   already established) - not a simulation, and not a hand-typed
   assumption about what the spec says.

iPadOS Safari (WebKit) publicly documents support for the same W3C
Pointer Events API tested here, including `pointerType: 'pen'` for Apple
Pencil, pressure, tilt, and hover via `pointerover`/`pointerout` without a
preceding `pointerdown` - this is standard-track web platform behaviour
that this repository's own capability-detection code (below) relies on
working the same way across compliant engines, not a WebKit-specific
assumption. Confirming the exact numbers on real iPadOS Safari with a
real Pencil is real-device validation this session could not perform, the
same limitation this repository's other renderer benchmarks already
document for GPU-bound work.

## `pointer-role.ts`: role classification (pure, DOM-free)

`classifyPointerInputRole(pointerType)` maps `'pen' -> 'pencil'`,
`'touch' -> 'finger'`, and everything else (including `'mouse'` and any
future/unrecognized value) safely to `'mouse'`. `POINTER_ROLE_ACTIONS`
encodes section 13's own three action lists verbatim, and a test
confirms the three roles share **zero** actions in common - genuinely
distinct interaction rules (section 11), not merely differently named.

Named `'mouse'`, not `'keyboard'`, for the third role deliberately: a
`PointerEvent` can only ever report `pointerType: 'mouse'` for a trackpad
or mouse click - it cannot observe keyboard input at all (a separate DOM
event family; see `keyboard-gesture.ts`). Section 13 groups "Keyboard and
trackpad" together because they share interaction rules, not because one
event field can tell them apart.

## Real browser capability check (headless Chromium 141.0.7390.37)

`packages/input-system/benchmarks/pencil-web-input/pencil-pointer-capability.html`,
driven by `scripts/run-pencil-pointer-capability-check.mjs`
(`pnpm benchmark:pencil-input`). Dispatches genuine `PointerEvent`
instances and records exactly which fields the browser's own event
object carries through to a real listener.

Result (2026-07-23, full JSON in
`benchmarks/results/pencil-pointer-capability-2026-07-23T19-04-32-870Z.json`):

| pointerType | pressure                                           | tiltX              | tiltY               | twist              | isPrimary |
| ----------- | -------------------------------------------------- | ------------------ | ------------------- | ------------------ | --------- |
| `pen`       | 0.62 (as dispatched)                               | 15 (as dispatched) | -20 (as dispatched) | 30 (as dispatched) | true      |
| `touch`     | 0 (no pressure/tilt supplied - browser default)    | 0                  | 0                   | 0                  | true      |
| `mouse`     | 0 (browser default, not in "active buttons" state) | 0                  | 0                   | 0                  | true      |

`pointerEventsSupported`: `true`. `hoverWithoutDownFired`: `true` - a
`pointerover` event fires for a `'pen'` pointer type with no preceding
`pointerdown`, exactly the mechanism a real Pencil-hover-preview feature
would listen for.

**Verdict**: the real Pointer Events implementation in this Chromium
engine correctly threads `pointerType`, `pressure`, `tiltX`/`tiltY`, and
`twist` through to a listener, and supports hover-without-down. Combined
with `pointer-role.ts`'s own classification logic (which reads exactly
`pointerType`), this repository's capability-detection approach for
Pencil/finger/mouse role separation is sound against a real Pointer
Events implementation - the remaining open question is real iPadOS
Safari + real Pencil hardware, not the web API contract itself.

## Native-vs-web comparison (sections 13, 108)

| Capability                                 | Web (Pointer Events)                                         | Native only                                                               |
| ------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Pencil vs. finger vs. mouse identification | Yes - `pointerType`                                          | -                                                                         |
| Pressure                                   | Yes - `pressure`                                             | -                                                                         |
| Tilt                                       | Yes - `tiltX`/`tiltY`                                        | -                                                                         |
| Hover preview (no contact)                 | Yes - `pointerover`/`pointerout` without `pointerdown`       | -                                                                         |
| Double tap                                 | Partial - a web app can time two `pointerdown` events itself | Native double-tap gesture recognizer                                      |
| Squeeze (Pencil Pro)                       | No web API exposes this                                      | Yes - native only (section 13's "Native-only opportunities", section 108) |
| Hover pose / angle beyond tilt             | No richer pose API on the web                                | Yes - native only                                                         |
| Haptic feedback                            | No web haptics API for Pencil                                | Yes - native only                                                         |

This table itself is drawn directly from sections 13 and 108's own
"Native-only opportunities" lists, not invented - the web-capable rows
are exactly what this session's real Chromium run above confirms works;
the native-only rows are exactly what those sections already name as
requiring native APIs.

## Hover-preview state machine (ARQ-172)

`packages/input-system/src/hover-preview.ts`'s `createHoverPreviewTracker`
builds the actual hover-preview interaction on top of the capability
confirmed above: `over` starts a session, `move` reports position while
hovering, `out` or a real `down` (contact) ends it. It only starts a
session for a pointer `pointer-role.ts` classifies as `'pencil'` -
section 13 assigns "hover preview" to Apple Pencil specifically, not
Finger or Keyboard/trackpad.

**A second real-browser check**
(`packages/input-system/benchmarks/pencil-web-input/hover-sequence-capability.html`,
`scripts/run-hover-sequence-capability-check.mjs`) dispatched a full
`over -> move -> move -> out` sequence (no `down`) for `pen`, `touch` and
`mouse` pointerTypes. Result (2026-07-23,
`benchmarks/results/hover-sequence-capability-2026-07-23T19-10-01-385Z.json`):
**identical for all three** - `["over","move","move","out"]`, no `down`,
2 move events each.

**Important, honest finding**: this shows the DOM's event-dispatch API
itself does not restrict a hover sequence by `pointerType` - any code
that constructs and dispatches these events can send a full hover
sequence claiming to be from any pointer type. The Pencil-only
restriction is therefore not something the browser enforces for us; it
is exactly what `hover-preview.ts`'s own role check enforces at the
application level (already verified by the DOM-free unit tests: a
`'touch'` or `'mouse'` `over` sample produces no `hover-start`). Separately,
real touchscreens do not have hardware proximity/hover sensing at all, so
a real finger physically cannot generate a `pointerover` before contact
the way a real Pencil's proximity sensor can - but confirming that
physical difference needs real touch hardware, which this sandboxed
environment does not have; only the synthetic-dispatch behaviour above
was verified here.
