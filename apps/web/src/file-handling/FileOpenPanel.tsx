import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ArqModalDialog } from '@arq/design-system';
import { reduceFileFlow, type FileFlowEvent, type FileFlowState } from './file-state-machine';
import { evaluateSelectedFile } from './evaluate-selected-file';
import { describeFileFlowState } from './describe-file-flow-state';
import {
  openNativeProject,
  type NativeOpenResult,
  type NativeWorkerFactory,
} from '../project/open-native-project';
import { createBrowserArqfsWorker } from '../project/browser-worker-factory';

export interface FileOpenPanelProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  /**
   * Called once a candidate has been fully validated, decoded and adopted -
   * never before. The workspace replaces its project only at this point, so a
   * rejected or cancelled candidate leaves whatever was already open untouched.
   */
  readonly onProjectOpened?: (opened: NativeOpenSuccess) => void;
  /** Injected so tests and the capability check can drive the flow without a real browser Worker. */
  readonly createWorker?: NativeWorkerFactory;
  /**
   * The working copy the workspace currently holds, so choosing the project that
   * is already open is recognised rather than attempted. The panel does not own
   * the session and must not read it directly.
   */
  readonly activeWorkingCopyId?: string | null;
}

type NativeOpenSuccess = Extract<NativeOpenResult, { status: 'opened' }>;

/**
 * UI-011: the real file-open surface - a file picker/drop target wired to the
 * actual byte-safe preflight gate (`evaluateSelectedFile`, which calls
 * `@arq/arqfs`'s `preflightArqfsBytes`) and format routing
 * (`routeBrowserFile`), both real, both already tested independently of any
 * UI. Before this component, `packages/arqfs`'s Phase 1 hardening had no
 * file-open path calling it at all in this app - ARQFS-001's own acceptance
 * criteria ("wire preflightArqfsBytes into every file-open path") was
 * unimplemented on the UI side.
 *
 * It now opens what it accepts, rather than stopping at "this file is safe to
 * open": a Worker is constructed, the bytes are imported into an OPFS working
 * copy, and the decoded project is handed to the caller. The order matters and
 * is load-bearing - every byte-level check runs first, so a refusal costs no
 * working copy and leaves nothing behind.
 *
 * Adoption stays the caller's. The panel never replaces the active project
 * itself, so a rejected or cancelled candidate leaves whatever was already open
 * exactly as it was.
 *
 * The gate is completeness, not bare compatibility. A database whose `-wal`
 * sidecar was not supplied is compatible and readable, and SQLite would open it
 * without complaint as of its last checkpoint - so it is refused here rather
 * than accepted behind a caution, because a caution shown beside a project that
 * is already on screen cannot undo the impression that the user's newest work
 * is present.
 */
export function FileOpenPanel(props: FileOpenPanelProps): JSX.Element {
  const {
    isOpen,
    onOpenChange,
    onProjectOpened,
    createWorker = createBrowserArqfsWorker,
    activeWorkingCopyId = null,
  } = props;
  const [state, setState] = useState<FileFlowState>({ kind: 'idle' });
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The panel is not always closed by the person using it: adopting a project
   * closes it from the workspace, without going through `onOpenChange`. So the
   * reset belongs to the closed transition itself rather than to the dismiss
   * handler - otherwise reopening the dialog after an open would still be
   * showing the previous file's verdict, and "house.arq is open." would sit
   * above a picker offering to open something else.
   */
  useEffect(() => {
    if (!isOpen) setState({ kind: 'idle' });
  }, [isOpen]);

  async function evaluate(file: File): Promise<void> {
    setState((current) => reduceFileFlow(current, { type: 'acquire', name: file.name }));
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      setState((current) =>
        reduceFileFlow(current, {
          type: 'fail',
          code: 'READ_FAILED',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return;
    }
    setState((current) => reduceFileFlow(current, { type: 'acquired' }));

    const evaluation = evaluateSelectedFile(bytes, file.name, file.type || undefined);
    const { route, completeness } = evaluation;
    if (route.kind === 'reject') {
      const { code, detail } = route;
      setState((current) => reduceFileFlow(current, { type: 'fail', code, message: detail }));
      return;
    }
    if (route.kind === 'import') {
      const { formatId } = route;
      setState((current) => reduceFileFlow(current, { type: 'route-import', formatId }));
      return;
    }
    // route.kind === 'open-native-arq'
    //
    // One rejection path for every reason a native candidate can be turned
    // away, including the one a file picker makes routine: a write-ahead-log
    // database arrives without the `-wal` sidecar holding its newest commits,
    // and is refused rather than opened behind a caution. The completeness
    // policy carries its own stable code, so truncation, "not an Arq file" and
    // a missing sidecar stay distinguishable in the reported detail.
    if (completeness === undefined || completeness.status === 'rejected') {
      const { code, reason } = completeness ?? {
        code: 'ARQ_SOURCE_NOT_EVALUATED',
        reason: 'This file was not checked, so it was not opened.',
      };
      setState((current) => reduceFileFlow(current, { type: 'fail', code, message: reason }));
      return;
    }
    // Always 'complete' by this point - a dependent database was refused above -
    // but read from the preflight rather than hard-coded, so the state carries
    // what was actually measured and cannot drift from it.
    const { sidecarDependency } = completeness.preflight;
    setState((current) => reduceFileFlow(current, { type: 'route-native', sidecarDependency }));

    // Only now is a Worker constructed and a working copy created. Everything
    // above this line is byte-level and leaves no trace if it refuses.
    //
    // The lifecycle states are driven from the pipeline's own boundaries rather
    // than announced in a burst at the end, so `workspace-active` - the only
    // state anything treats as open - is reached exactly once the project is.
    const emit = (event: FileFlowEvent) => setState((current) => reduceFileFlow(current, event));
    emit({ type: 'stage-start' });
    const opened = await openNativeProject(
      bytes,
      createWorker,
      file.name,
      {
        onStaged: (projectId) => {
          emit({ type: 'stage-complete', projectId });
          emit({ type: 'migration-verified' });
        },
        onWorkerOpened: (writable, lockReason) =>
          emit({
            // Two independent causes, and they are not interchangeable. The
            // file's own format version being ahead of this build is a property
            // of the bytes; another window holding the writer lock (ADR-0024) is
            // a property of this session, and resolves by closing that window.
            // The lock reason wins when both apply, because it is the one the
            // reader can actually act on.
            type: 'worker-opened',
            readOnlyReason: writable ? null : (lockReason ?? 'newer-format-version'),
          }),
        onHydrateStart: () => emit({ type: 'hydrate-start' }),
      },
      activeWorkingCopyId,
    );
    if (opened.status === 'already-open') {
      // Nothing to do and nothing to say beyond the truth: this project is the
      // one already open. The dialog closes rather than reporting a failure it
      // would be inventing.
      onOpenChange(false);
      return;
    }
    if (opened.status === 'rejected') {
      const { code, reason } = opened;
      emit({ type: 'fail', code, message: reason });
      return;
    }
    // Adoption is the last step, and it is the caller's: the panel never
    // replaces the active project itself. `hydrated` follows it, so nothing
    // reports the project as open before the workspace actually holds it.
    onProjectOpened?.(opened);
    emit({
      type: 'hydrated',
      facts: {
        projectName: opened.snapshot.displayName,
        // The reference model's own revision when the file carried one. A
        // project this build wrote records none, and 0 is the honest answer for
        // "this project has no revision" rather than an invented first one.
        revision: opened.snapshot.document?.summary.revision ?? 0,
        sidecarDependency: 'complete',
        conditionNote: opened.snapshot.warnings[0] ?? null,
      },
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) void evaluate(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggedOver(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) void evaluate(file);
  }

  function reset(): void {
    setState({ kind: 'idle' });
  }

  const description = describeFileFlowState(state);
  const busy = state.kind === 'acquiring' || state.kind === 'detecting';

  return (
    <ArqModalDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      // Points at the visible <h2> rather than repeating its text as an
      // aria-label, so the dialog's accessible name and its visible heading can
      // never drift apart.
      aria-labelledby="arq-file-open-title"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--arq-space-panel)',
          width: 480,
        }}
      >
        <h2 id="arq-file-open-title" style={{ margin: 0, font: 'inherit', fontWeight: 600 }}>
          Open project
        </h2>
        <div
          role="button"
          tabIndex={0}
          // No aria-label: the visible text below is the accessible name. An
          // aria-label of "Choose a file to open, or drop it here" over visible
          // text "Choose a file or drop it here" broke WCAG 2.5.3 (Label in
          // Name) - the visible string was not contained in the accessible
          // name, so a voice-control user speaking the label they can see would
          // not match this control.
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggedOver(true);
          }}
          onDragLeave={() => setIsDraggedOver(false)}
          onDrop={handleDrop}
          className="arq-shell-button"
          style={{
            justifyContent: 'center',
            minHeight: 120,
            border: `1px dashed var(--arq-ui-line-${isDraggedOver ? 'strong' : 'default'})`,
            background: isDraggedOver ? 'var(--arq-ui-surface-2)' : 'transparent',
          }}
        >
          Choose a file or drop it here
        </div>
        <input
          ref={inputRef}
          type="file"
          onChange={handleInputChange}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
          aria-hidden
          tabIndex={-1}
        />
        <div role="status" aria-live="polite" aria-busy={busy}>
          <p
            style={{
              margin: 0,
              fontWeight: description.tone === 'error' ? 600 : 400,
              color:
                description.tone === 'error' ? 'var(--arq-ui-ink)' : 'var(--arq-ui-text-primary)',
            }}
          >
            {/* No spinner glyph: `describeFileFlowState` already renders busy
                states as "Reading …"/"Checking …", so an emoji added nothing
                sighted users could not already read, while a screen reader
                announced it as literal "hourglass" noise inside a live region.
                `aria-busy` conveys the same state to assistive tech properly,
                and section 18's "structure over decoration" rule prefers the
                words to a glyph. */}
            {description.headline}
          </p>
          {description.detail !== null && (
            <details style={{ marginTop: 'var(--arq-space-micro)' }}>
              <summary style={{ color: 'var(--arq-ui-text-muted)', cursor: 'pointer' }}>
                Details
              </summary>
              <p style={{ color: 'var(--arq-ui-text-secondary)', wordBreak: 'break-word' }}>
                {description.detail}
              </p>
            </details>
          )}
        </div>
        {state.kind !== 'idle' && (
          <button type="button" className="arq-shell-button" onClick={reset}>
            Choose another file
          </button>
        )}
      </div>
    </ArqModalDialog>
  );
}
