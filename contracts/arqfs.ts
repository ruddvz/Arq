export interface ArqFormatVersion {
  readonly major: number;
  readonly minor: number;
  readonly schema: number;
  readonly minReaderMajor: number;
  readonly minWriterMajor: number;
}

export interface ArqOpenCapabilities {
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canMigrate: boolean;
  readonly safeModeRequired: boolean;
  readonly unsupportedRequiredFeatures: readonly string[];
}

export interface ArqResourceDescriptor {
  readonly sha256: string;
  readonly mediaType: string;
  readonly canonicalRole:
    | "source-underlay"
    | "source-import"
    | "authoritative-geometry"
    | "user-texture"
    | "portable-preview";
  readonly byteLength: number;
  readonly chunkSize: number;
  readonly chunkCount: number;
}

export interface ArqWorkingCopy {
  readonly projectId: string;
  readonly localRevision: number;
  readonly serverRevision?: number;
  readonly linkedExternalPath?: string;
  readonly localCommitState: "clean" | "writing" | "failed";
  readonly syncState: "offline" | "syncing" | "synced" | "conflict";
  readonly publicationState: "not-linked" | "current" | "pending" | "failed";
}
