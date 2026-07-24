import type { DerivedOutputMeta } from './types';
export interface FreshnessInput {
  readonly projectRevision: number;
  readonly semanticHash: string;
  readonly engineFingerprint: string;
}
export function freshnessReason(meta: DerivedOutputMeta, current: FreshnessInput): string | null {
  if (meta.engineFingerprint !== current.engineFingerprint) return 'engine-fingerprint-changed';
  if (meta.semanticHash !== current.semanticHash) return 'semantic-hash-changed';
  if (meta.projectRevision !== current.projectRevision) return 'project-revision-changed';
  if (meta.stale) return meta.staleReason ?? 'marked-stale';
  return null;
}
export function isFresh(meta: DerivedOutputMeta, current: FreshnessInput): boolean {
  return freshnessReason(meta, current) === null;
}
