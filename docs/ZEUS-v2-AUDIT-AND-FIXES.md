# Zeus v2 audit and v3 corrections

## Strong v2 foundations retained

Architecture truth hierarchy, Arq invariants, project reuse, senior quality gate,
pixel precision, security posture and honest evidence.

## Gaps fixed in v3

1. **Prompt optimization stopped too early.** v3 compiles a complete executor contract.
2. **Roles were listed but not orchestrated.** v3 assigns accountability, reviewers,
   file ownership and dependency waves.
3. **No formal plan-to-production state machine.** v3 adds one.
4. **PR/CI was guidance, not supervision.** v3 adds status, triage and release tooling.
5. **Merge safety lacked expected-head protocol.** v3 adds it.
6. **Build success could be confused with deployment success.** v3 separates them.
7. **Production verification was thin.** v3 adds deployed-SHA and Arq smoke evidence.
8. **Retry policy could be abused.** v3 bans blind deterministic reruns.
9. **Security gate needed CI token/supply-chain detail.** v3 adds it.
10. **Pixel precision began too late.** v3 starts at contract compilation.
11. **Run state was not machine-readable.** v3 adds schemas.
12. **No deterministic repository doctor/preflight.** v3 adds scripts.
13. **No guarded merge utility.** v3 adds an explicit-confirmation merge guard.
14. **No post-merge watcher.** v3 adds bounded release supervision.
