# Current truth conflicts and exposure limits

This list is intentionally short. It contains contradictions or scope gaps that
must alter release, support, or public wording.

## 3D implementation conflict

STATUS.md states that ModelCanvas renders extruded walls with shared plan and
3D selection. Later in the same file it states that the 3D stack has zero
consumers and no 3D surface exists.

The source tree contains apps/web/src/ModelCanvas.tsx and the app imports it,
which is evidence for a demo 3D surface. That does not automatically resolve
the product-release claim. Keep public wording qualified until an owner accepts
an end-to-end 3D contract.

## Local persistence overlap

The current app journals plan edits into IndexedDB through
apps/web/src/canvas/plan-journal.ts. ADR-0019 and ADR-0024 describe SQLite and
OPFS direction. The repository calls the overlap unresolved.

Do not translate journal success into a claim that a portable .arq file was
saved, updated, reopened, or ready to share.

## File compatibility versus file opening

FileOpenPanel performs byte-safe preflight and routing. Its own source says it
deliberately stops before constructing the browser Worker and OPFS driver.

Use compatible to describe the verdict. Use opened only after a project context
exists and is editable.

## Library capability versus product reachability

Import, export, arqfs, worker, and adapter packages are meaningful engineering
work. They are not proof that a user can complete the corresponding workflow
through apps/web.

## Security future baseline

SECURITY.md lists server-side authorisation, signed URLs, audit events, and
private-project behaviour while apps/api is currently a stub and account/sync
capabilities are not active. Treat those items as intended baseline unless an
active hosted path and its tests confirm them.
