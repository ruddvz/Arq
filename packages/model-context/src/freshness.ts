import type { ContextFreshness } from './types';
export function createContextFreshness(
  input: Omit<ContextFreshness, 'staleWarning'>,
): ContextFreshness {
  return {
    ...input,
    staleWarning:
      input.indexedRevision < input.projectRevision ||
      (input.activeViewRevision !== undefined && input.activeViewRevision < input.projectRevision),
  };
}
export function assertContextFresh(freshness: ContextFreshness): void {
  if (freshness.staleWarning)
    throw new Error(
      `context is stale: indexed ${freshness.indexedRevision}, project ${freshness.projectRevision}`,
    );
}
