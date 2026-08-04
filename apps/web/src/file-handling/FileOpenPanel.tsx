import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ArqModalDialog, useViewportProbe } from '@arq/design-system';
import { OPEN_STAGES } from '@arq/project-loading';
import { reduceFileFlow, type FileFlowState } from './file-state-machine';
import { describeFileFlowState } from './describe-file-flow-state';
import { openNativeProject, type NativeOpenAttempt } from './open-native-project';
import type { ArqfsWorkerFactory } from './arqfs-worker-transport';

export interface FileOpenPanelProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  /** Injected so the panel can be exercised without a real Worker, and so the app owns Worker construction. */
  readonly createWorker: ArqfsWorkerFactory;
  /**
   * Called once a project has really opened. The panel hands the attempt over
   * rather than activating anything itself: whether this project replaces the
   * one on screen is the workspace's decision, and keeping it there is what
   * guarantees a failed open leaves the current project alone.
   */
  readonly onProjectOpened: (attempt: Extract<NativeOpenAttempt, { status: 'opened' }>) => void;
  /** Whether a native project is currently open, so the panel can say what opening another will do. */
  readonly hasOpenProject: boolean;
}

/**
 * The file-open surface: a picker and drop target wired to the real read-only
 * open path - byte preflight and format routing on the main thread
 * (`evaluateSelectedFile`), then the Worker-owned SQLite open, integrity,
 * checksum and semantic checks (`openNativeProject`).
 *
 * It used to stop at "this file is safe to open", because nothing in this
 * application could open one. Now that something can, the panel's job changes
 * shape: the thing it must be careful about is no longer overclaiming an open,
 * it is being clear about what an open does and does not give the reader. Hence
 * the read-only sentence beside the success state, the replacement warning when
 * a project is already open, and an explicit close.
 */
export function FileOpenPanel(props: FileOpenPanelProps): JSX.Element {
  const { isOpen, onOpenChange, createWorker, onProjectOpened, hasOpenProject } = props;
  const [state, setState] = useState<FileFlowState>({ kind: 'idle' });
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLDivElement>(null);
  const probe = useViewportProbe({ widthPx: 1024, heightPx: 768, coarsePointer: false });
  /** Bumped per attempt so a slow open that has been superseded cannot write state. */
  const attemptRef = useRef(0);

  // The dialog restores focus to its opener on close, but on open the reader
  // should land on the action rather than on the heading, so the first Tab is not
  // spent getting to the only control that matters.
  useEffect(() => {
    if (isOpen) {
      chooseRef.current?.focus();
    }
  }, [isOpen]);

  async function open(file: File): Promise<void> {
    const attempt = (attemptRef.current += 1);
    const isCurrent = (): boolean => attemptRef.current === attempt;
    const advance = (event: Parameters<typeof reduceFileFlow>[1]): void => {
      if (isCurrent()) {
        setState((current) => reduceFileFlow(current, event));
      }
    };

    advance({ type: 'acquire', name: file.name });
    // Reading the file and preflighting it happen inside openNativeProject, which
    // is what keeps the "preflight before any Worker exists" order in one place
    // instead of split between here and there.
    advance({ type: 'acquired' });

    const result = await openNativeProject({
      file,
      createWorker,
      attemptId: `open-${attempt}`,
    });
    if (!isCurrent()) {
      // A superseded attempt still owns a Worker if it succeeded; releasing it
      // here is the difference between a replaced open and a leaked one.
      if (result.status === 'opened') {
        result.session.dispose();
      }
      return;
    }

    if (result.status === 'needs-import') {
      advance({ type: 'route-import', formatId: result.formatId });
      return;
    }
    if (result.status === 'failed') {
      advance({ type: 'fail', code: result.code, message: result.reason });
      return;
    }

    // Success. The flow's own states are walked in order rather than jumped,
    // because the sequence is what the governed file-flow policy requires be
    // kept distinct - and because the reader saw those states go by.
    const { staged } = result;
    advance({
      type: 'route-native',
      sidecarDependency:
        result.preflight?.status === 'accepted' ? result.preflight.sidecarDependency : 'complete',
    });
    advance({ type: 'open-start', stageName: OPEN_STAGES[0]!.name });
    const highest = staged.progress.highestCompleted ?? 0;
    advance({ type: 'open-stage', stageName: OPEN_STAGES[highest]!.name });
    advance({
      type: 'project-opened',
      projectName: staged.model.summary.projectName,
      revision: staged.model.summary.revision,
      conditionNote: conditionNoteFor(staged),
    });
    onProjectOpened(result);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) void open(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggedOver(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) void open(file);
  }

  function reset(): void {
    // Invalidates any attempt still in flight, so its result cannot land after
    // the reader has moved on.
    attemptRef.current += 1;
    setState({ kind: 'idle' });
  }

  const description = describeFileFlowState(state);
  const busy =
    state.kind === 'acquiring' || state.kind === 'detecting' || state.kind === 'opening-project';
  const finished = state.kind === 'project-open-read-only';
  // A pointer that cannot drag must not be told to drop. On a phone the drop
  // target is just a button, and calling it a drop zone describes a gesture the
  // reader does not have.
  const chooseLabel = probe.coarsePointer
    ? 'Choose a project file'
    : 'Choose a file or drop it here';

  return (
    <ArqModalDialog
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
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
          // Was a fixed 480px, which overflowed every phone viewport. The dialog
          // now fits the space it is given and stops growing on a desktop.
          width: '100%',
          maxWidth: 480,
        }}
      >
        <h2 id="arq-file-open-title" style={{ margin: 0, font: 'inherit', fontWeight: 600 }}>
          Open project
        </h2>
        {hasOpenProject && !finished && (
          <p style={{ margin: 0, color: 'var(--arq-ui-text-secondary)' }}>
            {/* Said before the choice, not after it: the reader is about to
                replace what is on screen. Nothing is lost - an opened project is
                read-only, so there are no unsaved edits to lose - and saying so
                is what stops the warning reading as a threat. */}
            Opening a project replaces the one currently open. Nothing is lost: an open project is
            read-only, so it has no unsaved changes.
          </p>
        )}
        <div
          role="button"
          tabIndex={0}
          ref={chooseRef}
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
            // Dashed, not filled: this is a region that accepts a file, and the
            // filled primary treatment belongs to the button that ends the task.
            border: `1px dashed var(--arq-ui-line-${isDraggedOver ? 'strong' : 'default'})`,
            background: isDraggedOver ? 'var(--arq-ui-surface-2)' : 'transparent',
          }}
        >
          {chooseLabel}
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
              // A project name or file name can be long, and a clipped name is
              // the one word in this dialog the reader most needs to read.
              overflowWrap: 'anywhere',
            }}
          >
            {/* No spinner glyph: `describeFileFlowState` already renders busy
                states as "Reading …"/"Opening …", so an emoji added nothing
                sighted users could not already read, while a screen reader
                announced it as literal "hourglass" noise inside a live region.
                `aria-busy` conveys the same state to assistive tech properly,
                and section 18's "structure over decoration" rule prefers the
                words to a glyph. */}
            {description.headline}
          </p>
          {description.detail !== null && (
            <details
              style={{ marginTop: 'var(--arq-space-micro)' }}
              // A failure's diagnostic is the reason the reader opened the
              // disclosure, so it is already open for one. Progress and success
              // detail stays folded away.
              open={description.tone === 'error'}
            >
              <summary style={{ color: 'var(--arq-ui-text-muted)', cursor: 'pointer' }}>
                {description.tone === 'error' ? 'Why it could not be opened' : 'Details'}
              </summary>
              <p style={{ color: 'var(--arq-ui-text-secondary)', overflowWrap: 'anywhere' }}>
                {description.detail}
              </p>
            </details>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--arq-space-micro)', flexWrap: 'wrap' }}>
          {/* One clear way out, always. Before this the only close paths were the
              backdrop and Escape, neither of which is discoverable, and a phone
              reader had no visible way to dismiss the dialog at all. */}
          {finished ? (
            <button
              type="button"
              className="arq-shell-button arq-shell-button--primary"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              View project
            </button>
          ) : (
            <button type="button" className="arq-shell-button" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
          )}
          {state.kind !== 'idle' && !finished && (
            <button type="button" className="arq-shell-button" onClick={reset}>
              Choose another file
            </button>
          )}
        </div>
      </div>
    </ArqModalDialog>
  );
}

/**
 * A one-sentence note about the file's condition, or null when there is nothing
 * worth saying. Derived from what the open actually found, never from a guess.
 */
function conditionNoteFor(
  staged: Extract<NativeOpenAttempt, { status: 'opened' }>['staged'],
): string | null {
  if (staged.safeModePlan.kind === 'interrupted-write') {
    return 'A previous write to this project did not finish, so it may be missing its most recent changes.';
  }
  if (staged.corruptOptionalPaths.length > 0) {
    return `Some optional project content could not be read: ${staged.corruptOptionalPaths.join(', ')}.`;
  }
  return null;
}
