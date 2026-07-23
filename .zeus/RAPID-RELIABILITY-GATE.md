# Rapid reliability gate

A task is complete only when the requested stop point has evidence.

## Fast

- intended file/behaviour changed;
- focused check passes;
- actual output inspected;
- no protected invariant triggered unexpectedly.

## Standard

Fast gate plus affected package checks, role/state/error paths, accessibility for UI,
and a separate critique pass.

## Deep

Standard gate plus architecture/security/format/recovery/benchmark evidence as
applicable, current PR/CI state, rollback, deployed SHA and production smoke when the
stop point reaches them.

Cached evidence is acceptable only for a low-risk check with the exact same worktree
fingerprint and unexpired TTL. It is never sufficient for security, migrations,
release, deployment or production.
