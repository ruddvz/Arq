# Recovery

```mermaid
flowchart LR
  A[Abnormal exit] --> B[Snapshot] --> C[Replay journal] --> D[Discard cache] --> E[Recovery summary] --> F[Open]
```
