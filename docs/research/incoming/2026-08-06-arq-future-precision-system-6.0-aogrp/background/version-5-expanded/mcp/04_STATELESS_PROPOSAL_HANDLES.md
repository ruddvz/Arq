# Stateless proposal handles

A proposal handle identifies server-side application state that is visible to the model and auditable by the host. It contains no authority by itself. Every call also supplies grant, project, base revision, proposal version, and expected digest. Missing or stale handles fail safely.
