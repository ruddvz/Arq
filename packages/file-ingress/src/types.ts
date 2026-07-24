export type ImportFidelity =
  'native' | 'exact' | 'structured' | 'approximated' | 'underlay' | 'attached' | 'rejected';

export type ImportIssueSeverity = 'info' | 'warning' | 'error' | 'fatal';

export interface InputFileDescriptor {
  readonly name: string;
  readonly byteLength: number;
  readonly mediaTypeHint?: string;
  readonly lastModifiedUnixMs?: number;
}

export interface FormatCandidate {
  readonly formatId: string;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly extensionMismatch: boolean;
}

export interface ImportIssue {
  readonly severity: ImportIssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly sourceObjectId?: string;
}

export interface SourceObjectMapping {
  readonly sourceObjectId: string;
  readonly stagedElementId?: string;
  readonly mappingKind: 'exact' | 'transformed' | 'approximated' | 'attached' | 'ignored';
  readonly confidence?: number;
  readonly notes?: string;
}

export interface StagedImportElement {
  readonly id: string;
  readonly kind: string;
  readonly sourceObjectId?: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface ImportResource {
  readonly sha256: string;
  readonly mediaType: string;
  readonly role:
    | 'source-underlay'
    | 'source-import'
    | 'authoritative-geometry'
    | 'user-texture'
    | 'portable-preview';
  readonly bytes: Uint8Array;
}

export interface ImportProgress {
  readonly stage: 'detecting' | 'hashing' | 'converting' | 'validating' | 'complete';
  readonly fraction: number;
  readonly message: string;
}

export interface ImportReport {
  readonly formatId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly fidelity: ImportFidelity;
  readonly sourceSha256: string;
  readonly sourceByteLength: number;
  readonly preservedCount: number;
  readonly convertedCount: number;
  readonly approximatedCount: number;
  readonly ignoredCount: number;
  readonly issues: readonly ImportIssue[];
  readonly timingsMs: Readonly<Record<string, number>>;
}

export interface ImportAdapterResult {
  readonly stagedElements: readonly StagedImportElement[];
  readonly resources: readonly ImportResource[];
  readonly mappings: readonly SourceObjectMapping[];
  readonly report: ImportReport;
}

export interface ImportPolicy {
  readonly maxSourceBytes: number;
  readonly maxStagedElements: number;
  readonly maxTextCodePoints: number;
  readonly deadlineUnixMs?: number;
  readonly allowNetworkBridge: boolean;
  readonly allowAttachmentFallback: boolean;
  readonly preserveOriginalSource: boolean;
}

export type SerializableImportPolicy = ImportPolicy;

export interface ImportAdapterContext {
  readonly bytes: Uint8Array;
  readonly source: InputFileDescriptor;
  readonly sourceSha256: string;
  readonly policy: ImportPolicy;
  readonly signal: AbortSignal;
  readonly onProgress?: (progress: ImportProgress) => void;
}

export interface ImportAdapter {
  readonly id: string;
  readonly version: string;
  readonly formatIds: readonly string[];
  readonly maximumFidelity: ImportFidelity;
  convert(context: ImportAdapterContext): Promise<ImportAdapterResult>;
}
