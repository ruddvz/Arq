---
description: Run incident stabilisation and recovery
---

Read `.zeus/FAST-KERNEL.md`. Force incident mode and the deep tier regardless of how
the task would otherwise classify. Force-load `.zeus/modules/incident.md`. Stabilise
first: record time, affected environment/SHA/users and severity; stop unsafe rollout;
preserve logs; identify the first bad change; choose rollback or forward-fix; verify
recovery; create follow-up prevention work. Route any additional modules, show the
compact contract, then execute:

$ARGUMENTS
