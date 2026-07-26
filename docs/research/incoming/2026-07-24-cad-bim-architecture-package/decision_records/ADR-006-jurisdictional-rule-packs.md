# ADR-006: Building-code checks are jurisdictional rule packs

**Status:** accepted  
**Date:** 24 July 2026

## Context

Code requirements vary by jurisdiction, edition, building classification, occupancy, renovation scope, local amendments, and interpretation. Hard-coded global thresholds are unsafe and difficult to audit.

## Decision

Arq evaluates only approved, versioned rule packs that declare jurisdiction, edition, effective date, applicability, authoritative source, and disclaimer. Findings include the target, evidence, source reference, and a review severity.

## Consequences

- The engine can support independent rule-pack updates.
- Missing or uncertain rules produce a review-required finding, not a compliance claim.
- Rule results are tied to a model revision and pack version.

## Rejected alternatives

- Global constants labelled "Ontario Building Code / IBC"
- A green compliance badge without scope and source
