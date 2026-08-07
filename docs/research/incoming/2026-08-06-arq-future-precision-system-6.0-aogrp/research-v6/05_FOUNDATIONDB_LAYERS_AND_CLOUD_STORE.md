# FoundationDB layers and cloud store

FoundationDB demonstrates a minimal transactional key-value substrate with higher-level layers. The lesson for ARQ is architectural: ARQ's semantic object and operation layer should be independent of the cloud database below it. A future collaboration service may use FoundationDB, PostgreSQL, object storage, or another engine, but clients exchange ARQ objects and revisions, not vendor-specific rows.
