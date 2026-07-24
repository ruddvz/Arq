export type OutputKind =
  | 'wall-display-mesh'
  | 'level-spatial-index'
  | 'room-boundary'
  | 'plan-projection-tile'
  | 'section-projection-tile'
  | 'sheet-preview'
  | 'pdf-vector-fragment'
  | 'thumbnail'
  | 'material-preview'
  | 'import-preview'
  | 'validation-result'
  | 'search-index';

export type CapabilityTier = 'web-basic' | 'web-full' | 'desktop' | 'ipad' | 'server';
export type RepresentationTier =
  | 'bounding-box'
  | 'simplified-2d'
  | 'cached-vector'
  | 'simplified-3d'
  | 'precise-active-view'
  | 'export-quality';
export type InvalidationPriority =
  | 'InteractiveCritical'
  | 'ActiveView'
  | 'VisibleBackground'
  | 'NonVisibleBackground'
  | 'ExportOnly'
  | 'AnalysisDeferred';

export interface CacheKeyInput {
  readonly namespaceVersion: number;
  readonly projectId: string;
  readonly semanticRevisionHash: string;
  readonly engineFingerprint: string;
  readonly outputKind: OutputKind;
  readonly scopeId: string;
  readonly styleHash?: string;
  readonly capabilityTier: CapabilityTier;
  readonly representationTier: RepresentationTier;
}

export interface DerivedOutputMeta {
  readonly projectId: string;
  readonly projectRevision: number;
  readonly semanticHash: string;
  readonly outputRevision: number;
  readonly engineFingerprint: string;
  readonly generatedAt: string;
  readonly sourceElementIds: readonly string[];
  readonly sourceOperationRange?: { readonly from: number; readonly to: number };
  readonly stale: boolean;
  readonly staleReason?: string;
  readonly computationTimeMs: number;
  readonly cacheHit: boolean;
  readonly approximationLevel: RepresentationTier;
}

export interface InvalidationTarget {
  readonly outputKind: OutputKind;
  readonly scopeId: string;
  readonly priority: InvalidationPriority;
  readonly reason: string;
}
