# ADR-011: Use progressive visual surfaces and accessible motion

## Status

Accepted

## Context

Arq benefits from polished contextual overlays, translucency, spring motion, tabular measurements, and platform-adaptive design. Browser support, device performance, visual contrast, input modality, and motion sensitivity vary widely. A visual effect that looks refined on a desktop display can reduce canvas frame time, obscure text, block interaction, or make keyboard usage difficult.

Experimental visual properties cannot be prerequisites for a usable CAD workspace.

## Decision

Arq supplies a contrast-safe opaque baseline surface, semantic typography, and keyboard-accessible controls. Blur, saturation, squircle corner shape, subtle velocity tilt, and spring animation are progressive enhancements.

- Backdrop blur is limited to small floating overlays and has an opaque fallback.
- Standard border radius is the baseline. Corner-shape enhancements are gated by support detection.
- One-pixel alpha borders are the cross-device baseline; half-pixel rendering is not assumed.
- Motion honors reduced-motion preference. Velocity tilt is capped, decorative, and disabled during direct text entry.
- HUD panel bodies do not capture pointer events; only controls receive interaction.
- Icon-only controls require accessible names, visible focus, and appropriate hit targets.

## Consequences

### Positive

- The workspace remains readable and operable across supported browsers, displays, and assistive technologies.
- Glass and motion can be tuned after measured visual and performance tests without becoming architectural dependencies.
- The design system has a clear fallback policy for canvas-intensive screens.

### Negative

- Pixel-perfect visual sameness across platforms is not a goal.
- Some aesthetic enhancements appear only on browsers that support them.
- The component library needs explicit focus, contrast, and motion tests in addition to visual snapshots.

## Validation

- Reduced-motion mode removes nonessential panel spring, tilt, and attention animation.
- A HUD does not intercept canvas interactions outside its controls.
- Opaque fallback is readable at target contrast without backdrop blur.
- Icon controls are operable and named with keyboard and assistive technology.
- A large model with the palette and diagnostics open meets the documented frame-time target on target hardware.
