# Reliability and cache policy

Only successful low-risk check results may be reused. The cache key includes repository
HEAD, binary worktree diff, untracked file hashes and lock/package files. TTL defaults
to five minutes. Any content change produces a new key.

Never reuse cached evidence for security, migrations, `.arq` integrity, recovery,
release, CI, deployment, production or incident checks. Context index entries are hash
bound; current permissions and remote state are always live.
