# Zeus 3 audit and Zeus 4 corrections

Zeus 3 had strong delivery control but its default operating path could still load too
many long policy files, rescan the repository and run broad checks repeatedly.

Zeus 4 fixes this with a tiny kernel, deterministic routing, hard context budgets,
incremental indexing, worktree fingerprints, short-lived low-risk check caching,
impact-selected validation and one unified CLI. Critical evidence remains live and
uncached. The system is faster by doing less irrelevant work, not by skipping necessary
work.
