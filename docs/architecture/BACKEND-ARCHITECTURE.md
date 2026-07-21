# Backend architecture

Initial responsibilities:

- authentication;
- workspaces;
- project metadata;
- permissions;
- snapshots;
- operation sync;
- exports;
- comments and issues later;
- audit events.

Initial infrastructure:

- PostgreSQL;
- S3-compatible storage;
- queue only when asynchronous jobs require it;
- no Redis until measured need.
