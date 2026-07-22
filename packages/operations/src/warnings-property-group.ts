/**
 * ARQ-134: build warnings group.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 12 ("Right inspector") lists "Warnings" as its own group. Unlike
 * ARQ-130 through ARQ-133's groups (which live in @arq/bim-core), this
 * one lives in @arq/operations: the data it displays - ValidationMessage
 * (validation-result.ts, ARQ-066) - already lives here, and bim-core
 * must not depend on operations (the reverse direction is the
 * established one), so this module preserves that direction rather than
 * moving ValidationMessage or duplicating its shape.
 *
 * A project accumulates ValidationMessages from many independent checks
 * (e.g. validateOpeningOverlaps, ARQ-109) that were never computed with
 * "one element's inspector panel" in mind - each message just lists
 * every affectedElementIds it concerns. buildWarningsPropertyGroup is
 * the one filtering step an inspector actually needs: given one
 * element's id and the full set of current validation messages, keep
 * only the ones naming that element.
 *
 * Ordered most-severe-first (error, then warning, then info) since that
 * is what a user scanning one element's Warnings group needs to see
 * first - ties keep the order validation produced them in, using a
 * stable sort so this reordering never fabricates significance among
 * messages of equal severity.
 */

import type { ElementId } from '@arq/bim-core';
import { type ValidationMessage, type ValidationSeverity, hasErrors } from './validation-result';

export interface WarningsPropertyGroup {
  readonly messages: readonly ValidationMessage[];
}

const SEVERITY_RANK: Readonly<Record<ValidationSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** Filters `allMessages` down to the ones naming `elementId`, ordered most-severe-first. */
export function buildWarningsPropertyGroup(
  elementId: ElementId,
  allMessages: readonly ValidationMessage[],
): WarningsPropertyGroup {
  const relevant = allMessages.filter((message) => message.affectedElementIds.includes(elementId));
  const ordered = [...relevant].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return { messages: ordered };
}

/** True when this element's Warnings group contains at least one blocking (error-severity) message. */
export function warningsGroupHasErrors(group: WarningsPropertyGroup): boolean {
  return hasErrors(group.messages);
}
