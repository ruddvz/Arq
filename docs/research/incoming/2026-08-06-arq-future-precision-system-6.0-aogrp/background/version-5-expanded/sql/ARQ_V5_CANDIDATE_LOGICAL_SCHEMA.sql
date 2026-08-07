-- Candidate logical schema for package demonstrations only.
-- Production identifiers and migrations require repository allocation.
PRAGMA foreign_keys = ON;

CREATE TABLE arq_meta (
  key TEXT PRIMARY KEY,
  value BLOB NOT NULL
) WITHOUT ROWID;

CREATE TABLE arq_project (
  project_id TEXT PRIMARY KEY CHECK(length(project_id)=36),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 500),
  created_format_version INTEGER NOT NULL CHECK(created_format_version>0),
  current_format_version INTEGER NOT NULL CHECK(current_format_version>0),
  minimum_reader_version INTEGER NOT NULL CHECK(minimum_reader_version>0),
  minimum_writer_version INTEGER NOT NULL CHECK(minimum_writer_version>0),
  current_revision TEXT NOT NULL CHECK(length(current_revision)=64)
) WITHOUT ROWID;

CREATE TABLE arq_publication (
  publication_id TEXT PRIMARY KEY CHECK(length(publication_id)=36),
  project_id TEXT NOT NULL REFERENCES arq_project(project_id),
  source_revision TEXT NOT NULL CHECK(length(source_revision)=64),
  publisher_build TEXT NOT NULL,
  published_at TEXT NOT NULL,
  semantic_root TEXT NOT NULL CHECK(length(semantic_root)=64)
) WITHOUT ROWID;

CREATE TABLE arq_capability (
  namespace TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  requirement TEXT NOT NULL CHECK(requirement IN ('required','optional')),
  preservation TEXT NOT NULL CHECK(preservation IN ('interpreted','opaque-byte-preserving','discardable-derived')),
  owner TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE arq_object (
  object_id TEXT PRIMARY KEY CHECK(length(object_id)=36),
  type_id TEXT NOT NULL,
  created_revision TEXT NOT NULL CHECK(length(created_revision)=64),
  deleted_revision TEXT CHECK(deleted_revision IS NULL OR length(deleted_revision)=64)
) WITHOUT ROWID;

CREATE TABLE arq_component (
  object_id TEXT NOT NULL REFERENCES arq_object(object_id),
  schema_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  payload BLOB NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
  PRIMARY KEY(object_id,schema_id)
) WITHOUT ROWID;

CREATE TABLE arq_relation (
  relation_id TEXT PRIMARY KEY CHECK(length(relation_id)=36),
  type_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES arq_object(object_id),
  target_id TEXT NOT NULL REFERENCES arq_object(object_id),
  role TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK(ordinal>=0),
  payload BLOB NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64)
) WITHOUT ROWID;

CREATE TABLE arq_operation_group (
  group_id TEXT PRIMARY KEY CHECK(length(group_id)=36),
  project_id TEXT NOT NULL REFERENCES arq_project(project_id),
  base_revision TEXT NOT NULL CHECK(length(base_revision)=64),
  actor_class TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  canonical_payload BLOB NOT NULL,
  group_sha256 TEXT NOT NULL CHECK(length(group_sha256)=64),
  accepted_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE arq_operation (
  group_id TEXT NOT NULL REFERENCES arq_operation_group(group_id),
  ordinal INTEGER NOT NULL CHECK(ordinal>=0),
  operation_id TEXT NOT NULL UNIQUE CHECK(length(operation_id)=36),
  type_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  canonical_payload BLOB NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
  PRIMARY KEY(group_id,ordinal)
) WITHOUT ROWID;

CREATE TABLE arq_revision (
  revision_id TEXT PRIMARY KEY CHECK(length(revision_id)=64),
  project_id TEXT NOT NULL REFERENCES arq_project(project_id),
  parent_1 TEXT CHECK(parent_1 IS NULL OR length(parent_1)=64),
  parent_2 TEXT CHECK(parent_2 IS NULL OR length(parent_2)=64),
  operation_group_id TEXT NOT NULL REFERENCES arq_operation_group(group_id),
  state_root TEXT NOT NULL CHECK(length(state_root)=64),
  created_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE arq_asset (
  asset_id TEXT PRIMARY KEY CHECK(length(asset_id)=36),
  sha256 TEXT NOT NULL UNIQUE CHECK(length(sha256)=64),
  media_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length>=0),
  role TEXT NOT NULL,
  required INTEGER NOT NULL CHECK(required IN (0,1)),
  data BLOB
) WITHOUT ROWID;

CREATE TABLE arq_external_reference (
  reference_id TEXT PRIMARY KEY CHECK(length(reference_id)=36),
  kind TEXT NOT NULL,
  target_project_id TEXT,
  target_revision TEXT,
  expected_sha256 TEXT,
  canonical_payload BLOB NOT NULL,
  required INTEGER NOT NULL CHECK(required IN (0,1))
) WITHOUT ROWID;

CREATE TABLE arq_evidence (
  evidence_id TEXT PRIMARY KEY CHECK(length(evidence_id)=36),
  kind TEXT NOT NULL,
  scope TEXT NOT NULL,
  state TEXT NOT NULL,
  canonical_payload BLOB NOT NULL,
  created_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX arq_component_schema_idx ON arq_component(schema_id);
CREATE INDEX arq_relation_source_idx ON arq_relation(source_id,type_id);
CREATE INDEX arq_relation_target_idx ON arq_relation(target_id,type_id);
CREATE INDEX arq_revision_project_idx ON arq_revision(project_id,created_at);
