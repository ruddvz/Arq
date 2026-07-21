create extension if not exists pgcrypto;
create type workspace_role as enum ('owner','administrator','editor','commenter','viewer');
create type job_status as enum ('queued','running','succeeded','failed','cancelled');
create type job_kind as enum ('import','export','thumbnail','validation');
create type issue_status as enum ('open','in_progress','blocked','resolved','closed');

create table app_user (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 display_name text not null, email_verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create table workspace (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 created_by uuid not null references app_user(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), deleted_at timestamptz);
create table workspace_membership (
 workspace_id uuid not null references workspace(id) on delete cascade,
 user_id uuid not null references app_user(id) on delete cascade, role workspace_role not null,
 invited_by uuid references app_user(id), joined_at timestamptz not null default now(), primary key(workspace_id,user_id));
create table project (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspace(id) on delete cascade,
 name text not null check(length(name) between 1 and 200), schema_version integer not null default 0,
 current_revision bigint not null default 0, unit_system text not null check(unit_system in ('metric','imperial')),
 created_by uuid not null references app_user(id), archived_at timestamptz, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index project_workspace_idx on project(workspace_id) where deleted_at is null;
create table file_object (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspace(id) on delete cascade,
 storage_key text not null unique, media_type text not null, bytes bigint not null check(bytes>=0), sha256 char(64) not null,
 created_by uuid references app_user(id), created_at timestamptz not null default now(), deleted_at timestamptz);
create table project_snapshot (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references project(id) on delete cascade,
 revision bigint not null, file_object_id uuid not null references file_object(id), schema_version integer not null,
 created_by uuid references app_user(id), created_at timestamptz not null default now(), unique(project_id,revision));
create table project_operation (
 project_id uuid not null references project(id) on delete cascade, sequence bigint not null, operation_id uuid not null,
 actor_id uuid not null references app_user(id), operation_type text not null, base_revision bigint not null,
 payload jsonb not null, preconditions jsonb not null default '[]', affected_element_ids jsonb not null default '[]',
 validation jsonb not null default '[]', created_at timestamptz not null,
 primary key(project_id,sequence), unique(project_id,operation_id));
create table import_record (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references project(id) on delete cascade,
 source_file_id uuid not null references file_object(id), format text not null, format_version text,
 status job_status not null, report jsonb, created_by uuid not null references app_user(id),
 created_at timestamptz not null default now(), completed_at timestamptz);
create table export_record (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references project(id) on delete cascade,
 revision bigint not null, format text not null, status job_status not null, output_file_id uuid references file_object(id),
 report jsonb, created_by uuid not null references app_user(id), created_at timestamptz not null default now(), completed_at timestamptz);
create table project_comment (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references project(id) on delete cascade,
 author_id uuid not null references app_user(id), body text not null check(length(body) between 1 and 10000),
 target jsonb not null, resolved_at timestamptz, resolved_by uuid references app_user(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create table project_issue (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references project(id) on delete cascade,
 title text not null check(length(title) between 1 and 300), description text, status issue_status not null default 'open',
 assignee_id uuid references app_user(id), created_by uuid not null references app_user(id), target jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz);
create table share_link (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references project(id) on delete cascade,
 token_hash char(64) not null unique, role workspace_role not null check(role in ('commenter','viewer')),
 allow_download boolean not null default false, expires_at timestamptz, revoked_at timestamptz,
 created_by uuid not null references app_user(id), created_at timestamptz not null default now());
create table background_job (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspace(id) on delete cascade,
 project_id uuid references project(id) on delete cascade, kind job_kind not null, status job_status not null default 'queued',
 idempotency_key text, payload jsonb not null, progress numeric(5,4) not null default 0 check(progress between 0 and 1),
 stage text, attempts integer not null default 0, error_code text, error_detail jsonb,
 created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 unique(workspace_id,idempotency_key));
create table audit_event (
 id bigint generated always as identity primary key, workspace_id uuid references workspace(id) on delete set null,
 project_id uuid references project(id) on delete set null, actor_id uuid references app_user(id) on delete set null,
 event_type text not null, target_type text, target_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create index audit_event_workspace_time_idx on audit_event(workspace_id,created_at desc);
