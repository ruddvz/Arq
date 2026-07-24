# CMP-076: AI proposal panel

## Purpose

Preview intent, assumptions and operations.

## Anatomy

- Stated intent summary
- List of assumptions the proposal made
- List of proposed operations (rows are CMP-077)
- Accept/reject/edit actions

## Required states

- Proposing (loading)
- Ready for review
- Partially accepted (some operations accepted, others rejected)
- Fully accepted
- Fully rejected

## Behaviour

- Never applies a single proposed operation to the real model until the user explicitly accepts it (or that specific operation) - matches this repo's own AI-guardrails discipline that architects remain responsible and proposals may be wrong.
- Every assumption the AI made is stated explicitly, never silently baked into the proposal with no visibility.
- Supports accepting individual operations rather than only all-or-nothing, since a mostly-good proposal with one wrong operation should not have to be entirely discarded.

## Sizing

- Typically a CMP-027 Drawer or full panel given the amount of content (intent, assumptions, potentially many operations); scrolls internally.

## Keyboard and accessibility

- Arrow Up/Down moves focus between listed operations; each has its own accept/reject Tab stops (delegates to CMP-077).

## Acceptance criteria

- [ ] No proposed operation is ever applied to the real model without explicit per-operation or whole-proposal acceptance.
- [ ] Every assumption is visibly stated, not silently embedded.
- [ ] Partial (per-operation) acceptance is genuinely supported, not just all-or-nothing.
