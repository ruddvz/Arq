# CMP-083: Support bundle control

## Purpose

Create diagnostics with explicit consent.

## Anatomy

- Explanation of exactly what diagnostic data will be included
- Explicit consent checkbox/action
- Create action

## Required states

- Awaiting consent
- Creating
- Ready to share/download

## Behaviour

- Never creates or transmits a diagnostics bundle without an explicit, informed consent action - never automatic, matching this repo's privacy-conscious design intent.
- States exactly what categories of data are included (e.g. logs, model metadata) and, just as importantly, what is explicitly excluded (e.g. real project content/analytics), so consent is genuinely informed.

## Sizing

- Typically hosted in CMP-026 Dialog given the significance of the consent decision.

## Keyboard and accessibility

- Follows CMP-026 Dialog's keyboard contract; the consent checkbox and create action are independent Tab stops, with create disabled until consent is given.

## Acceptance criteria

- [ ] Bundle creation is impossible without the explicit consent step having occurred first.
- [ ] Included and excluded data categories are both stated plainly, not just included categories.
