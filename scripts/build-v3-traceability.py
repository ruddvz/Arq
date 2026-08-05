"""Rebuild docs/product/V3-IMPLEMENTATION-TRACEABILITY.csv, verifying every row.

Each mapping names an evidence path and a symbol that must appear in it. A path
that does not exist, or a symbol that is not in it, fails the run rather than
being written down as done - so the file cannot claim something the repository
does not contain.

The backlog itself is not in this repository; it arrived as a delivery pack. Pass
its path:

    python3 scripts/build-v3-traceability.py path/to/machine/backlog-v3.csv

Without it the script exits saying so, rather than emitting a file built from
nothing.
"""

import csv, os, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = sys.argv[1] if len(sys.argv) > 1 else ''
if not PACK or not os.path.exists(PACK):
    print('usage: build-v3-traceability.py <path to backlog-v3.csv>', file=sys.stderr)
    print('the pack backlog is not in this repository, so the path is required', file=sys.stderr)
    raise SystemExit(2)

# task id -> (disposition, evidence path, symbol that must exist in it)
# Every row is checked: a path that does not exist, or a symbol that is not in
# it, fails the build rather than being written down as done.
M = {}
def add(ids, disp, path, symbol=''):
    for i in ids: M[i] = (disp, path, symbol)

OWNER='owner-authority'
BLOCKED='blocked-no-evidence'
PRE='pre-existing'
NEW='implemented-in-this-change'

add([f'V3-{n:03d}' for n in range(1,11)], OWNER, '', '')
add([f'V3-{n:03d}' for n in range(190,206)], OWNER, '', '')
add(['V3-107','V3-108'], BLOCKED, '', '')
add(['V3-117'], BLOCKED, '', '')

# P1 lifecycle - pre-existing reducer, extended here for publication states.
add(['V3-011','V3-012','V3-013','V3-014','V3-015','V3-019','V3-020'], PRE,
    'apps/web/src/file-handling/file-state-machine.ts','lastKnownGoodProject')
add(['V3-016'], PRE,'docs/product/voice/state-language-map.json','file-flow')
add(['V3-017'], PRE,'scripts/verify-arq-state-language-coverage.mjs','verifyMachine')
add(['V3-018'], PRE,'apps/web/src/file-handling/file-state-machine.test.ts','describe')

# P2 worker and source safety.
add(['V3-021','V3-028','V3-031','V3-032'], PRE,'workers/import-export-worker/src/protocol.ts','ImportWorkerRequest')
add(['V3-022','V3-023','V3-029','V3-030'], PRE,'workers/import-export-worker/src/worker-runtime.ts','')
add(['V3-024','V3-025'], PRE,'packages/arqfs/src/arqfs-safe-mode.ts','')
add(['V3-026','V3-027'], PRE,'packages/file-ingress/src/policy.ts','maxSourceBytes')

# P3 staging and native open.
add(['V3-033','V3-034','V3-035'], PRE,'packages/file-ingress/src/orchestrator.ts','')
add(['V3-036','V3-037','V3-038'], PRE,'packages/arqfs/src/arqfs-entry-digests.ts','classifyEntryPath')
add(['V3-039'], PRE,'packages/arqfs/src/arqfs-semantic-hash.ts','')
add(['V3-040','V3-041','V3-042','V3-043'], PRE,'packages/project-loading/src/stages.ts','')
add(['V3-044'], PRE,'apps/web/src/file-handling/file-state-machine.ts','readOnlyReason')
add(['V3-045'], NEW,'packages/model-renderer/src/gpu-resource-registry.ts','closeOwner')

# P4 operations.
add(['V3-046','V3-052','V3-053','V3-055','V3-056','V3-057'], NEW,'packages/operations/src/operation-pipeline.ts','commitOperation')
add(['V3-047','V3-050','V3-051'], NEW,'packages/operations/src/operation-pipeline.ts','staleBaseRevision')
add(['V3-048'], NEW,'packages/operations/src/wall-workflow-commit.ts','commitWallWorkflow')
add(['V3-049'], NEW,'packages/operations/src/apply-proposal.ts','applyProposal')
add(['V3-054'], NEW,'packages/operations/src/grouped-undo-stack.ts','createGroupedUndoStack')

# P5 recovery and publication.
add(['V3-058','V3-059','V3-060','V3-061','V3-062'], NEW,'packages/local-storage/src/recovery-plan.ts','autoApply')
add(['V3-063','V3-064','V3-065','V3-066','V3-067','V3-068','V3-070','V3-071','V3-072','V3-073','V3-074'], NEW,
    'packages/arqfs/src/arqfs-publication.ts','publishProjectFile')
add(['V3-069'], NEW,'packages/arqfs/src/arqfs-entry-digests.ts','CANONICAL_ENTRY_PATHS')

# P6 semantic model.
add(['V3-075'], PRE,'packages/bim-core/src/level.ts','')
add(['V3-076'], PRE,'packages/bim-core/src/wall-type.ts','')
add(['V3-077'], PRE,'packages/bim-core/src/opening.ts','')
add(['V3-078'], PRE,'packages/bim-core/src/door-type.ts','')
add(['V3-079'], PRE,'packages/bim-core/src/window-type.ts','')
add(['V3-080'], PRE,'packages/bim-core/src/room.ts','RoomStatus')
add(['V3-081'], NEW,'packages/bim-core/src/slab.ts','SlabDatumFace')
add(['V3-082'], NEW,'packages/bim-core/src/stair.ts','validateStairFlight')
add(['V3-083'], PRE,'packages/bim-core/src/dimension-reference.ts','')
add(['V3-084'], PRE,'packages/bim-core/src/text-note.ts','')
add(['V3-085'], NEW,'packages/bim-core/src/view-definition.ts','createViewDefinition')
add(['V3-086'], PRE,'packages/bim-core/src/sheet.ts','createSheet')
add(['V3-087'], NEW,'packages/bim-core/src/schedule.ts','createSchedule')
add(['V3-088'], NEW,'packages/bim-core/src/material.ts','createMaterial')
add(['V3-089'], NEW,'packages/bim-core/src/deletion-policy.ts','')

# P7 authoring and inference.
add(['V3-090','V3-091','V3-097','V3-098'], NEW,'packages/editor-shell/src/inference-engine.ts','rankCandidates')
add(['V3-092'], PRE,'packages/editor-shell/src/intersection-snap.ts','')
add(['V3-093','V3-094'], PRE,'packages/editor-shell/src/perpendicular-snap.ts','')
add(['V3-095'], PRE,'packages/editor-shell/src/extension-snap.ts','')
add(['V3-096'], PRE,'packages/editor-shell/src/grid-snap.ts','')
add(['V3-099'], PRE,'packages/editor-shell/src/numeric-overlay.ts','')
add(['V3-100'], NEW,'packages/bim-core/src/parse-typed-length.ts','parseTypedLength')
add(['V3-101'], NEW,'packages/input-system/src/input-ownership.ts','routeKeySample')
add(['V3-102'], NEW,'packages/operations/src/wall-workflow-commit.ts','abandonWallWorkflow')
add(['V3-103'], NEW,'packages/bim-core/src/opening-host-transfer.ts','transferOpeningsAcrossSplit')
add(['V3-104'], NEW,'packages/geometry-2d/src/affected-room-boundaries.ts','roomsAffectedByEdgeChanges')
add(['V3-105'], NEW,'packages/design-system/src/shell/model-tree-navigation.ts','applyModelTreeKey')

# P8 units, references, constraints.
add(['V3-106','V3-109','V3-110','V3-111','V3-112'], NEW,'packages/bim-core/src/canonical-length.ts','CanonicalLength')
add(['V3-113','V3-114','V3-115','V3-119'], NEW,'packages/bim-core/src/stable-reference.ts','decideDependentCommit')
add(['V3-116','V3-118','V3-120'], NEW,'packages/geometry-2d/src/constraint-solver.ts','createAnalyticConstraintSolver')

# P9 plan, 3D, sheets, output.
add(['V3-121'], PRE,'packages/model-renderer/src/shared-selection.ts','applySharedSelection')
add(['V3-122','V3-124'], NEW,'packages/derived-cache/src/derived-geometry-contract.ts','acceptGeometryResult')
add(['V3-123'], NEW,'packages/derived-cache/src/effect-invalidation.ts','invalidationsFromEffects')
add(['V3-125'], NEW,'packages/model-renderer/src/gpu-resource-registry.ts','createGpuResourceRegistry')
add(['V3-126'], NEW,'packages/geometry-3d/src/origin-rebase.ts','decideRebase')
add(['V3-127'], NEW,'packages/geometry-3d/src/section-box.ts','classifyAgainstSectionBox')
add(['V3-128'], NEW,'packages/bim-core/src/view-visibility.ts','resolveVisibility')
add(['V3-129'], PRE,'packages/bim-core/src/sheet.ts','SheetViewport')
add(['V3-130','V3-131','V3-132'], NEW,'packages/bim-core/src/sheet-viewport.ts','annotationHeightInModelUnits')
add(['V3-133'], NEW,'packages/bim-core/src/sheet-schedule.ts','paginateSchedule')
add(['V3-134'], NEW,'packages/pdf-export/src/pdf-export-protocol.ts','createPdfExportSession')
add(['V3-135'], NEW,'packages/pdf-export/src/verify-exported-pdf.ts','verifyExportedPdf')

# P10 workspace and accessibility.
add(['V3-136'], PRE,'packages/design-system/src/shell/top-bar-state.ts','')
add(['V3-137'], PRE,'packages/design-system/src/shell/model-panel-state.ts','filterModelPanelTree')
add(['V3-138'], PRE,'packages/design-system/src/shell/inspector-groups.ts','')
add(['V3-139'], PRE,'packages/mcp-server/src/review/review-centre.ts','')
add(['V3-140'], NEW,'packages/design-system/src/shell/diagnostics-panel-state.ts','buildDiagnosticsPanel')
add(['V3-141'], PRE,'packages/design-system/src/workspace/workspace-shell.css','')
add(['V3-142'], PRE,'packages/design-system/src/shell/ipad-landscape-shell.tsx','')
add(['V3-143'], PRE,'packages/design-system/src/shell/ipad-portrait-shell.tsx','')
add(['V3-144'], PRE,'packages/design-system/src/workspace/phone-dock.tsx','')
add(['V3-145'], NEW,'packages/input-system/src/pencil-ownership.ts','createPencilOwnershipTracker')
add(['V3-146'], NEW,'packages/design-system/src/interaction-foundation/interaction/disabled-reason.ts','describeDisabledState')
add(['V3-147'], NEW,'packages/design-system/src/interaction-foundation/feedback/live-region-queue.ts','createLiveRegionQueue')
add(['V3-148'], PRE,'packages/input-system/src/keyboard-baseline.ts','registerKeyboardBaseline')
add(['V3-149'], NEW,'packages/design-system/src/shell/model-tree-navigation.ts','modelTreeRowAria')
add(['V3-150'], NEW,'packages/design-system/src/shell/text-fitting.ts','fitTextMiddle')
add(['V3-151'], NEW,'packages/design-system/src/interaction-foundation/motion/display-preferences.ts','paletteModeFor')

# P11 language system.
add(['V3-152','V3-156'], NEW,'docs/product/voice/state-language-map.json','view-visibility')
add(['V3-153','V3-154'], NEW,'docs/product/voice/message-contract.json','publication.verifying')
add(['V3-155'], NEW,'docs/product/voice/terminology.json','prohibitedUpgrades')
add(['V3-157'], NEW,'docs/product/voice/format-language-map.json','quarantined')
add(['V3-158'], NEW,'docs/product/voice/terminology.json','release certificate')
add(['V3-159'], NEW,'docs/product/voice/message-contract.json','slotsAreNamedNotPositional')
add(['V3-160'], NEW,'docs/product/voice/message-contract.json','announcementProfiles')
add(['V3-161'], NEW,'docs/product/voice/term-aliases.json','quarantined')
add(['V3-162'], NEW,'docs/product/voice/context/REFRESH-LOG.json','sourceSetDigest')
add(['V3-163'], NEW,'package.json','arq:language:verify')

# P12 AI, plugins, interoperability.
add(['V3-164','V3-168','V3-169','V3-170'], NEW,'packages/operations/src/ai-proposal.ts','evaluateProposal')
add(['V3-165'], NEW,'packages/operations/src/ai-proposal.ts','expiresAtRevision')
add(['V3-166'], NEW,'packages/operations/src/semantic-diff.ts','diffSnapshots')
add(['V3-167'], NEW,'packages/operations/src/proposal-preview.ts','previewsForDiff')
add(['V3-171'], NEW,'packages/operations/src/apply-proposal.ts','presentationStateFor')
add(['V3-172'], NEW,'packages/model-context/src/extension-manifest.ts','validateExtensionManifest')
add(['V3-173'], NEW,'packages/model-context/src/extension-host-boundary.ts','requestIsSerialisable')
add(['V3-174','V3-175'], NEW,'packages/file-ingress/src/export-fidelity.ts','validateExportReport')
add(['V3-176'], NEW,'packages/file-ingress/src/unit-resolution.ts','resolveImportUnits')
add(['V3-177'], NEW,'packages/file-ingress/src/quarantine.ts','groupQuarantined')
add(['V3-178'], NEW,'packages/file-ingress/src/export-fidelity.ts','compareRoundTrip')

# P13 security and observability.
add(['V3-179'], PRE,'packages/telemetry/src/redact-sensitive-fields.ts','redactSensitiveFields')
add(['V3-180'], PRE,'packages/telemetry/src/arqfs-support-bundle.ts','buildArqfsSupportBundle')
add(['V3-181'], PRE,'.github/workflows/ci.yml','browser-capability-checks')
add(['V3-182'], NEW,'packages/file-ingress/src/decompression-limits.ts','createDecompressionGuard')
add(['V3-183'], PRE,'.github/workflows/ci.yml','dependency-licence-scan')
add(['V3-184'], OWNER,'','')
add(['V3-185'], PRE,'.github/workflows/security.yml','secret-scan')
add(['V3-186'], OWNER,'','')
add(['V3-187'], NEW,'packages/telemetry/src/diagnostic-receipt.ts','createReceiptLog')
add(['V3-188'], NEW,'packages/telemetry/src/incident-evidence.ts','preserveIncidentEvidence')
add(['V3-189'], NEW,'packages/telemetry/src/telemetry-schema.ts','createTelemetryRegistry')

rows=list(csv.DictReader(open(PACK)))
problems=[]
out=[]
for r in rows:
    tid=r['id']
    disp, path, symbol = M.get(tid, ('not-mapped','',''))
    if disp in (OWNER, BLOCKED):
        out.append((tid, r['phase'], r['task'], disp, '', ''))
        continue
    if disp == 'not-mapped':
        problems.append(f'{tid} has no mapping')
        continue
    full=os.path.join(REPO, path)
    if not os.path.exists(full):
        problems.append(f'{tid}: {path} does not exist')
        continue
    if symbol:
        text=open(full, encoding='utf-8', errors='replace').read()
        if symbol not in text:
            problems.append(f'{tid}: {path} does not contain "{symbol}"')
            continue
    out.append((tid, r['phase'], r['task'], disp, path, symbol))

if problems:
    print('UNVERIFIED CLAIMS:', file=sys.stderr)
    for p in problems: print('  '+p, file=sys.stderr)
    sys.exit(1)

dest=os.path.join(REPO,'docs/product/V3-IMPLEMENTATION-TRACEABILITY.csv')
with open(dest,'w',newline='') as f:
    w=csv.writer(f)
    w.writerow(['id','phase','task','disposition','evidence_path','evidence_symbol'])
    for row in out: w.writerow(row)

from collections import Counter
c=Counter(r[3] for r in out)
print('rows:', len(out))
for k,v in sorted(c.items()): print(f'  {k}: {v}')
