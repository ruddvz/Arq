# Arq UI/UX critique and required improvements v4.0

## What the visual system gets right

- Calm monochrome architectural language
- Strong information hierarchy
- Clear separation between public, dashboard and editor contexts
- Consistent cards, borders and restrained iconography
- Good use of plans, sections and building imagery
- AI proposal flow that separates request, assumptions, operations, validation and apply

## Problems found and mandatory fixes

### Brand inconsistency

Several renderings use typed “Arq” text. Replace it with the canonical wordmark or
symbol. Use Phthalo Green only as the controlled accent.

### Navigation inconsistency

The boards alternate between “Get started,” “Try Arq free” and “Get started free.”
Define one entitlement-aware CTA system and one authenticated app navigation system.

### Placeholder claims

Pricing, version numbers, uptime, certification marks, privacy claims, storage,
performance, security and legal text are illustrative only. They must not ship until
validated by engineering, finance, security and counsel.

### Missing states

Every page must specify:

- loading;
- empty;
- offline;
- stale;
- permission denied;
- recoverable error;
- destructive confirmation;
- success;
- partial success;
- unsupported-file or unsupported-device state.

### Editor density

The desktop editor is appropriately dense, but tablet and phone layouts cannot merely
shrink it. Use adaptive panels, drawers, staged disclosure and explicit capability
tiers.

### Save and sync clarity

Use distinct states:

- Editing locally
- Saved locally
- Syncing
- Synced
- Offline
- Conflict
- External file publication pending or failed

Never show one ambiguous “Saved” label for all of these.

### Canvas accessibility

Canvas-only information requires:

- keyboard navigation;
- accessible object tree;
- programmatic selection announcements;
- focus restoration;
- non-colour selection indication;
- text alternatives for model-health markers;
- reduced-motion behaviour.

### Touch and Pencil

- 44 × 44 CSS-pixel minimum targets
- palm rejection strategy
- Pencil hover where available
- no hover-only actions
- gesture conflict handling
- precision loupe or numeric entry for small geometry

### AI safety

“Apply proposal” must require a visible diff, affected-element count, assumptions,
validation status, undo guarantee and new revision. Failed or partial operations must
leave the committed model unchanged.

### Destructive actions

Archive, delete workspace, restore, overwrite import, migration and conflict
resolution need consequence-focused confirmation and recovery information.

### Responsive public pages

Long tables such as open-source notices, issues and keyboard shortcuts require
responsive columns, horizontal scrolling with affordance, filtering and accessible
table semantics.

## Visual polish requirements

- Use an 8-point spacing system.
- Keep 1 px borders on aligned device pixels.
- Avoid low-contrast grey text below WCAG thresholds.
- Use consistent radius and elevation tokens.
- Do not mix illustration styles within one page family.
- Use real icons from the technical icon package; do not regenerate them per screen.
- Define hover, focus, pressed, selected, disabled and busy states for every control.
