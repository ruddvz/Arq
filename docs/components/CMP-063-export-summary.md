# CMP-063: Export summary

## Purpose

Report output and warnings.

## Anatomy

- Success/failure summary
- List of warnings (e.g. content that could not be represented in the target format)
- Output file/location reference

## Required states

- Success (no warnings)
- Success with warnings
- Failed

## Behaviour

- Reports every real warning the export pipeline actually produced - never suppresses a warning to present a cleaner-looking summary.
- Distinguishes "succeeded with caveats" from "succeeded cleanly" as genuinely different states, not the same green checkmark for both.

## Sizing

- Scrolls internally for exports with many warnings rather than truncating the list.

## Keyboard and accessibility

- Each listed warning, where it links to a source object, is reachable by Tab, following CMP-032's pattern.

## Acceptance criteria

- [ ] Every real warning from the export pipeline is shown, none suppressed for presentation.
- [ ] "Succeeded with warnings" is visually and programmatically distinct from a fully clean success.
