# File-association plan (FP-012)

Reference templates for associating the `.arq` file extension with the Arq
application across Windows, Apple platforms, and PWA installs, so a future
native/PWA packaging step has a real starting point instead of none.

## What exists today

- **Extension:** `.arq`
- **MIME type:** `application/vnd.arq.project+sqlite` (RFC 6838 vendor tree -
  no registered IANA media type exists for this yet; this is this repo's own
  working value until/unless one is registered)
- **Windows ProgID:** `Arq.Project.1`
- **Apple UTI:** `com.arq.project`
- **SQLite `application_id`:** `0x41525131` (`"ARQ1"`) - see
  `docs/architecture/ARQ-FILE-FORMAT.md` and
  `packages/file-ingress/src/native-arq-header.ts`

Templates live in `packages/file-ingress/platform-templates/`:

| Platform | File                                          | Merges into                                            |
| -------- | --------------------------------------------- | ------------------------------------------------------ |
| Windows  | `windows/arq-file-association.reg`            | Applied by a real installer (MSIX/WiX/Squirrel)        |
| Apple    | `apple/ArqDocumentType.plist.fragment.xml`    | The app target's real `Info.plist`                     |
| PWA      | `pwa/file-handlers.webmanifest.fragment.json` | `apps/web`'s real `manifest.json` (does not exist yet) |

Each template is a deliberately incomplete fragment, not a standalone
artifact meant to be shipped as-is - each file's own header comment says
exactly what a real packaging step must still supply (install path, real
bundle identifier, real manifest fields).

`packages/file-ingress/src/file-association-templates.test.ts` cross-checks
the three templates parse (the JSON fragment is validated with a real
`JSON.parse`, not just eyeballed) and consistently reference the same
extension (`.arq` / `arq`), MIME type, and identifiers - a template drifting
out of sync with the others fails this test, not just a doc claim.

## What this does NOT prove

This repository cannot build or sign a real macOS, iPadOS, or Windows
application - there is no native/Electron/Tauri shell yet (see
`DESKTOP-SHELL-PLAN.md`, `IPAD-PLAN.md`), and code signing requires real
Apple/Microsoft developer credentials this sandbox does not have. That means
none of the following has been - or can be - verified here:

- that double-clicking a real `.arq` file on a real Windows/macOS/iPadOS
  machine actually launches Arq;
- that Finder/Explorer/Files actually offers Arq as an option for `.arq`
  files;
- real PWA `file_handlers` browser support/behaviour (Chromium-family only,
  and still evolving - see the File Handling API's own browser support
  matrix);
- any real icon assets referenced by these templates (the PWA fragment's
  icon path is a placeholder - no such asset exists in this repo).

These are honestly left as "needs a signed native/PWA build to actually
test," the same boundary already documented for the iPad/RoomPlan hardware
gaps elsewhere in this repo (`LIDAR-ROOMPLAN-PLAN.md`).

## Defense in depth: OS association is not trust

None of these three mechanisms make Arq trust a file's contents. Every real
open path independently verifies the SQLite `application_id` via
`inspectNativeArqHeader` before treating a file as a genuine Arq project - a
file merely named `*.arq` (or carrying `.arq`'s MIME type/UTI by accident or
by a hostile actor) is rejected at that check regardless of how the OS
routed it to Arq.

## Non-goals

- Not building or signing an actual native/Electron/Tauri shell - none
  exists in this repo yet; these templates are prepared-ahead-of-need
  reference material.
- Not registering a real IANA media type or verifying trademark clearance
  for the reverse-DNS/ProgID identifiers above - both remain open,
  human-only decisions (see `LICENSE-DECISION-REQUIRED.md` for this repo's
  existing pattern of flagging legal/identity decisions it cannot make
  itself).
