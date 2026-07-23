# ADR-0026: Accessible component foundation

**Status:** Approved for prototype
**Date:** 2026-07-21

## Decision

Use React Aria Components as the primary foundation for ordinary interface controls,
with Arq styling and a controlled escape to lower-level hooks for specialist widgets.

Custom canvas interactions must provide equivalent keyboard, focus, status and
assistive-technology access through the model tree, inspector and command system.

Do not mix multiple complete primitive systems without an approved exception.
