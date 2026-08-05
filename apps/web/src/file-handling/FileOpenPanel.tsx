import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ArqModalDialog } from '@arq/design-system';
import { reduceFileFlow, isProjectOpen, type FileFlowState } from './file-state-machine';
import { evaluateSelectedFile } from './evaluate-selected-file';
import { describeFileFlowState } from './describe-file-flow-state';
import {
  openNativeProject,
  type OpenNativeProjectDependencies,
  type OpenNativeProjectOutcome,
} from '../project/open-native-project';
import {
  connectProjectWorker,
  digestSourceBytes,
  newProjectId,
} from '../project/connect-project-worker';

export interface FileOpenPanelProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  /**
   * Called once a project has genuinely reached `workspace-active`, so the shell
   * can adopt it. Nothing before that point is an open project, so nothing
   * before that point is reported here.
   */
  readonly onProjectOpened?: (
    outcome: Extract<OpenNativeProjectOutcome, { kind: 'workspace-active' }>,
  ) => void;
  /**
   * Worker construction and digesting, injected so this component can be driven
   * without a browser. Defaults to the real ones.
   */
  readonly transport?: Pick<OpenNativeProjectDependencies, 'connect' | 'digestSource'>;
  /** Project id factory, injected for the same reason. */
  readonly createProjectId?: () => string;
}

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
 * The preflight verdict is where this used to stop, because nothing in this app
 * constructed the Worker that opens a project. It now continues: a file that
 * routes as a native Arq project is staged into an ARQ-owned working project,
 * opened through the real Worker, checked and hydrated by `openNativeProject`,
 * which drives the same reducer this component renders. "This file is safe to
 * open" and "this project is open" are still different statements - the
 * difference is now the several lifecycle states between them, each of which
 * has to actually succeed.
 */
export function FileOpenPanel(props: FileOpenPanelProps): JSX.Element {
  const { isOpen, onOpenChange, onProjectOpened, transport, createProjectId } = props;
  const [state, setState] = useState<FileFlowState>({ kind: 'idle' });
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openControllerRef = useRef<AbortController | null>(null);

  // An open in flight when this component goes away would otherwise keep a
  // Worker - and its exclusive handle on the project's OPFS file - alive with
  // nothing left to receive the result.
  useEffect(
    () => () => {
      openControllerRef.current?.abort();
    },
    [],
  );

  async function openNative(bytes: Uint8Array): Promise<void> {
    const controller = new AbortController();
    openControllerRef.current = controller;
    try {
      const outcome = await openNativeProject(
        {
          projectId: (createProjectId ?? newProjectId)(),
          bytes,
          signal: controller.signal,
        },
        {
          connect: transport?.connect ?? connectProjectWorker,
          digestSource: transport?.digestSource ?? digestSourceBytes,
          emit: (event) => setState((current) => reduceFileFlow(current, event)),
        },
      );
      if (outcome.kind === 'workspace-active') onProjectOpened?.(outcome);
    } finally {
      openControllerRef.current = null;
    }
  }

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
    const { route, preflight } = evaluation;
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
    if (preflight?.status === 'rejected') {
      const { code, reason } = preflight;
      setState((current) => reduceFileFlow(current, { type: 'fail', code, message: reason }));
      return;
    }
    // A file picker yields one file, so a write-ahead-log project arrives
    // without the `-wal` sidecar holding its newest commits. Passing the
    // preflight's finding through is what lets the flow say "compatible" and
    // "may not be complete" as the separate facts they are.
    setState((current) =>
      reduceFileFlow(current, {
        type: 'route-native',
        sidecarDependency: preflight?.sidecarDependency ?? 'complete',
      }),
    );
    await openNative(bytes);
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
    openControllerRef.current?.abort();
    setState({ kind: 'idle' });
  }

  const description = describeFileFlowState(state);
  // Every state where work is genuinely in flight, so `aria-busy` describes the
  // whole open rather than only its first two steps.
  const busy =
    state.kind === 'acquiring' ||
    state.kind === 'detecting' ||
    state.kind === 'staging' ||
    state.kind === 'staged' ||
    state.kind === 'migration-verified' ||
    state.kind === 'worker-open' ||
    state.kind === 'hydrating' ||
    state.kind === 'recovering' ||
    state.kind === 'publishing';
  const cancellable =
    state.kind === 'staging' ||
    state.kind === 'worker-open' ||
    state.kind === 'hydrating' ||
    state.kind === 'migration-verified' ||
    state.kind === 'staged';

  return (
    <ArqModalDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
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
        {cancellable && (
          <button
            type="button"
            className="arq-shell-button"
            onClick={() => openControllerRef.current?.abort()}
          >
            Stop opening
          </button>
        )}
        {state.kind !== 'idle' && !cancellable && (
          <button
            type="button"
            className="arq-shell-button"
            onClick={reset}
            // A project that is open is not something to walk away from by
            // accident: the same button that restarts a failed attempt would
            // otherwise discard a working project without saying so.
            disabled={isProjectOpen(state)}
          >
            Choose another file
          </button>
        )}
      </div>
    </ArqModalDialog>
  );
}
