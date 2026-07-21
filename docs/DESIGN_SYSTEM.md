# Design system direction

> **Superseded.** [`docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md`](product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md)
> §12 defines the current design tokens, type scale, and icon system (Lucide-based
> rather than Phosphor-based, plus JetBrains Mono for numerics). Kept here as an
> earlier draft for history.

Answers the brief directly: monochrome, "perfect looking," Plus Jakarta Sans, and a
pre-decided icon system. This is a starting system to build against and refine on real
screens — treat exact values as a first pass, not final tokens.

## Principle

The UI should be quiet enough that the drawing is the only thing with color. This is a
deliberate response to `PAIN_POINTS.md` #9 (dated, cluttered incumbent UIs) — restraint
is the differentiator, not a decoration budget. Precedents worth studying: Linear,
Things 3, Apple's own first-party apps — all monochrome-or-near-it chrome with
hierarchy carried by weight, size, and spacing instead of color.

**Important scope boundary:** the monochrome constraint applies to app **chrome**
(navigation, panels, toolbars, text) — not to the building model itself. Materials,
renders, and anything the architect is actually designing need true color and
real materials. Arq's UI is grayscale; what it renders is not.

## Color

Avoid pure `#000000`/`#FFFFFF` — harsh full-contrast black-on-white causes eye strain
over long sessions, which matters for a tool people use for hours. Use near-black and
near-white anchors with a gray scale between them:

| Token | Light mode | Dark mode | Use |
|---|---|---|---|
| `bg.canvas` | `#FAFAFA` | `#0A0A0A` | App background |
| `bg.surface` | `#FFFFFF` | `#141414` | Cards, panels |
| `border.subtle` | `#E5E5E5` | `#262626` | Dividers, hairlines |
| `border.default` | `#D4D4D4` | `#333333` | Input/control borders |
| `text.primary` | `#171717` | `#F5F5F5` | Primary text |
| `text.secondary` | `#666666` | `#A3A3A3` | Secondary/meta text |
| `text.disabled` | `#A3A3A3` | `#525252` | Disabled state |
| `accent.critical` | `#D32F2F` | `#F87171` | Destructive/error only — never decorative |

That critical-red is the **only** non-gray color in the entire system, and it's
reserved exclusively for errors and destructive confirmations (e.g. "delete this
load-bearing wall") — not for buttons, links, or branding. Hierarchy elsewhere comes
from weight and contrast, not hue.

Ship both light and dark mode from day one — a monochrome system makes this cheap, and
it's expected on Apple platforms. Open question to validate on real screens rather than
decide here: whether the 3D viewport should default to dark (common in pro 3D tools —
Blender, Figma's canvas) while 2D drafting views default to light, or whether the whole
app should follow one system-wide mode for consistency.

## Typography

**Plus Jakarta Sans** as the single typeface across every platform (iOS, macOS,
Windows, web) — confirmed SIL Open Font License 1.1, free for commercial use, no
licensing fees. Using one custom typeface everywhere (rather than each OS's system
font) is what makes the brand feel deliberate rather than default — the same reasoning
Linear/Notion/Figma apply. It's a geometric sans with enough warmth to avoid feeling
cold, which suits "precise but not sterile."

Suggested type scale (adjust once tested on-device):

| Token | Size / weight | Use |
|---|---|---|
| `display` | 32 / Bold | Marketing, empty states |
| `title` | 22 / SemiBold | Screen/panel titles |
| `heading` | 17 / SemiBold | Section headers |
| `body` | 15 / Regular | Default UI text |
| `caption` | 13 / Regular | Meta, secondary labels |
| `label` | 12 / Medium, uppercase, tracked | Field labels, tags |

**Numbers need their own treatment.** Dimensions, coordinates, and schedules are a huge
part of this product, and proportional numerals in a humanist sans don't read as
"precise." Pair Plus Jakarta Sans body text with a **tabular-figure monospace for all
measurements and numeric data** (candidate: JetBrains Mono, or Plus Jakarta Sans's own
numeric/tabular OpenType features if sufficient — needs an actual side-by-side test,
flagged as unresolved rather than guessed here).

## Icons

Recommendation: **don't commission icons from zero.** Fork an existing
permissively-licensed, stroke-based monochrome icon set as the base for all standard UI
icons (navigation, actions, file types) — **Phosphor** is the suggested starting point
(large library, six weights, MIT-licensed, consistent geometry that's easy to restyle
to match Plus Jakarta Sans's warmth). Then hand-draw the ~30–50 **CAD/BIM-specific
glyphs** the base set doesn't have — wall, door, window, slab, roof, section cut,
level, grid, dimension line, IFC export, LiDAR scan, and similar — in matching stroke
weight, corner radius, and optical size so the combined set reads as one family, not
"generic icons plus some custom ones bolted on."

Keep the icon set **identical across every platform** rather than substituting Apple's
SF Symbols on iOS/macOS. SF Symbols is well-integrated and free, but relying on it for
brand-critical icons means the web/Windows builds would need a second icon language
later — the exception is truly system-level chrome (share sheet, system back gesture
affordances) where platform-native behavior is expected and should stay native rather
than be reskinned.

Icon grid: 24×24px base, ~1.5px stroke, consistent 2px corner radius on square
terminals — standard values to start from Phosphor's own grid rather than inventing a
new one.

## Layout and spacing

- **4pt base spacing unit** (multiples of 4: 4/8/12/16/24/32...) — standard, plays well
  with iOS's point-based layout and with Apple Pencil precision at small touch targets.
- Corner radii: small controls 6px, cards/panels 12px, sheets/modals 20px — kept
  consistent and small (never fully rounded/pill-shaped) to read as precise rather than
  playful.
- Elevation without color: since there's no color budget to spend on "this panel is
  above that one," hierarchy between surfaces comes from a combination of a 1px
  `border.subtle` line and a very soft, short-radius shadow (5–10% opacity black,
  small blur) — enough to separate layers without looking decorative.

## Motion

Restrained and functional, matching the "perfect looking, not flashy" brief:
short durations (~150–200ms), a single consistent ease-out curve for entrances and
ease-in for exits, no bounce/spring effects on structural UI (panels, sheets). Reserve
any more expressive motion (e.g. a model materializing after a LiDAR scan completes)
for genuinely significant moments, not routine navigation — motion should communicate
state change, not decorate it.

## What's intentionally not decided here

- Exact numeric scale needs validation against real iOS Human Interface Guidelines
  minimum touch targets (44×44pt) before being final.
- Tabular-numeral font pairing (see Typography) needs an actual rendered comparison.
- Default light/dark behavior for the 3D viewport vs. 2D views (see Color).

These are flagged as the next round of decisions once there are real screens to look
at, not resolved by description alone.
