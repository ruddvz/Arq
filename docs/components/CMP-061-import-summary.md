# CMP-061: Import summary

## Purpose

Report preserved and unsupported content.

## Anatomy

- Per-format fidelity summary (native/exact/structured/approximated/underlay/attached/rejected)
- List of preserved vs unsupported content
- Link to detailed issues (delegates to CMP-032)

## Required states

- Success (fully preserved)
- Partial (some content approximated/attached/ignored)
- Failed

## Behaviour

- Never claims an import was "exact" when it was actually approximated or merely attached - fidelity is reported honestly using the real fidelity levels the ingress pipeline actually produces (`packages/file-ingress`), never rounded up.
- Every unsupported/approximated item is individually listed, not summarised away into a single vague count.

## Sizing

- Scrolls internally for imports with many individual issues rather than truncating the list.

## Keyboard and accessibility

- Each listed issue, where actionable, is a real link/button reachable by Tab, following CMP-032's pattern.

## Acceptance criteria

- [ ] Fidelity reported always matches the real adapter/report fidelity level, never inflated.
- [ ] Every unsupported/approximated item is individually visible, not hidden behind a count alone.
