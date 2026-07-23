# Delivery permission matrix

- Local read/test: repository access.
- Branch/file write: contents write.
- Issue/PR mutation: issues/pull-request write.
- Workflow rerun: actions write.
- Merge: pull-request/content permission plus branch policy.
- Deployment: provider/environment authority.
- Production rollback: explicit production authority.

Repository metadata may report push capability while an integration still lacks a specific endpoint scope. Evidence comes from a representative operation, not assumption.
