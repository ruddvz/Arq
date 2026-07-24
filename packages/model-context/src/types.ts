export interface ContextFreshness {
  readonly projectRevision: number;
  readonly indexedRevision: number;
  readonly activeViewRevision?: number;
  readonly staleWarning: boolean;
  readonly sourceIds: readonly string[];
  readonly retrievalQuality: 'exact' | 'partial' | 'approximate';
}
export interface OmissionReference {
  readonly ref: string;
  readonly projectRevision: number;
  readonly queryHash: string;
  readonly resultHash: string;
  readonly createdAt: string;
  readonly permissionScope: string;
  readonly omittedCount: number;
  readonly summary: string;
}
export interface ElementContextRequest {
  readonly elementIds: readonly string[];
  readonly include: readonly (
    'relationships' | 'dependants' | 'annotations' | 'views' | 'sheets' | 'diagnostics' | 'history'
  )[];
  readonly projectRevision: number;
}
export interface ModelContextEnvelope<T> {
  readonly data: T;
  readonly freshness: ContextFreshness;
  readonly omissions: readonly OmissionReference[];
}
