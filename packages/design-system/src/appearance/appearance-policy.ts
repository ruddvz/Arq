/**
 * The appearance policy this repository has actually accepted, and the guard
 * that keeps the code honest about it.
 *
 * Two clauses, both from the plan of record that STATUS.md names -
 * `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`:
 *
 * - Section 14 ("Visual direction") requires a monochromatic, calm, precise
 *   professional instrument, "free from decorative gradients, glass effects and
 *   excessive rounded cards".
 * - Section 15 ("Appearance policy") locks Release 1 to a light appearance
 *   only, because "dark mode should not be shipped as an untested token
 *   inversion", and makes dark mode a separate milestone.
 *
 * Both clauses were re-proposed against by an external design package (ARQ
 * Liquid Glass Product System 12.0), which asks for a translucent material
 * layer on the floating control surfaces and for a designed technical dark
 * appearance. Neither is implemented here.
 *
 * The reason is the authority order, and the design package agrees with it: its
 * own `02_AUTHORITY_REPOSITORY_RECONCILIATION.md` ranks "accepted ADRs and
 * active contracts" above "Version 12 root specifications after
 * reconciliation". A design package is an input to the decision that would
 * change section 14 and section 15; it is not that decision, and it never
 * mentions either clause. No ADR in `docs/adr/` supersedes them.
 *
 * So the honest state is "blocked pending an accepted decision", not "not done
 * yet". This module is what makes that state legible in code and keeps the
 * change from arriving by accident, one CSS rule at a time - the same job
 * `scripts/check-editor-dependency-boundaries.mjs` does for Lenis.
 *
 * To unblock: record an ADR that supersedes the relevant clause, then flip the
 * `accepted` flag here in the same change. The guard test will then require the
 * implementation rather than forbid it, which is the point - the flag is not a
 * feature switch, it is a record of what was decided.
 */

export type AppearanceFeature = 'translucent-material' | 'dark-appearance';

export interface AppearanceFeaturePolicy {
  /** Whether repository authority currently permits this in shipped UI. */
  readonly accepted: boolean;
  /** The clause that decides it, quoted well enough to find. */
  readonly governedBy: string;
  /** What an owner would have to do to change the answer. */
  readonly decisionNeeded: string;
}

export const APPEARANCE_POLICY: Readonly<Record<AppearanceFeature, AppearanceFeaturePolicy>> = {
  'translucent-material': {
    accepted: true,
    governedBy:
      'ADR-0031, which narrows blueprint section 14 (Visual direction) so that its "glass effects" prohibition covers decorative use only, and permits one bounded material on floating control surfaces.',
    decisionNeeded:
      'Decided by ADR-0031. Reopening it means superseding that ADR, not editing this flag: the conditions are the decision, and material.css is the only permitted implementation.',
  },
  'dark-appearance': {
    accepted: true,
    governedBy:
      'ADR-0032, which supersedes blueprint section 15 (Appearance policy) and opens the dark-appearance milestone for the UI chrome.',
    decisionNeeded:
      "Decided by ADR-0032. Section 15's objection was that dark must not ship as an untested token inversion, so the measured contrast test is the standing condition, not a one-off.",
  },
};

export function appearanceFeatureIsAccepted(feature: AppearanceFeature): boolean {
  return APPEARANCE_POLICY[feature].accepted;
}

/**
 * The reason a feature may not ship, or null when it may.
 *
 * Returns prose rather than a boolean because the caller that needs this is a
 * person reading a failed check, and "false" does not tell them which clause
 * to go and change.
 */
export function appearanceFeatureBlockedReason(feature: AppearanceFeature): string | null {
  const policy = APPEARANCE_POLICY[feature];
  return policy.accepted ? null : `${policy.governedBy} Decision needed: ${policy.decisionNeeded}`;
}
