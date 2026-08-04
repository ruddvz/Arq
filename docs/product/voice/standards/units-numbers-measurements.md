# Units, numbers, measurements, and precision

ARQ is a precision tool. Numbers are part of the language system.

## Unit attachment

Never display a dimensional value without its unit unless the field or table column unambiguously supplies the unit.

Prefer:

- 74 mm
- 2.40 m
- 32.5°
- 12.00 m²

## Display versus storage

A rounded displayed number is not the authoritative stored value.

Copy should not imply otherwise.

Good:

> Displayed to the nearest millimetre.

Bad:

> Stored at 1 mm accuracy.

unless storage precision is actually the subject and evidenced.

## Locale

Parse and display according to explicit project/user locale rules when implemented, but keep a canonical internal value.

Never silently reinterpret `1,200` or `1.200` across locales.

## Imperial input

When fractional imperial input is supported, help examples must match the parser's accepted syntax rather than inventing variants.

## Progress percentages

Percentages represent task progress only when the task can produce meaningful progress.

Do not show a fabricated smooth percentage for work whose completion fraction is unknown.

## Counts

Counts should identify the object:

- 3 warnings
- 12 selected walls
- 4 conflicting operations

Avoid:

- 3 items
- 12 things
  when the object type is known.
