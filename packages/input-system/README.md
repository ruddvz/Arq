# @arq/input-system

Input abstraction distinguishing Pencil, touch, mouse, and keyboard as
explicit input types: gesture trackers (tap/drag), keyboard shortcut
registry, and pointer classification - implemented and unit-tested.

Not yet integrated: `apps/web` currently drives its canvas with raw React
pointer events; migrating it onto these trackers (so Pencil/touch/mouse get
their designed distinct behaviours) is open wiring work, tracked against the
iPad milestone.
