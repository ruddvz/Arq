import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ArqModalDialog } from '@arq/design-system';
import { reduceFileFlow, type FileFlowState } from './file-state-machine';
import { evaluateSelectedFile } from './evaluate-selected-file';
import { describeFileFlowState } from './describe-file-flow-state';

export interface FileOpenPanelProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
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
 * Deliberately stops at reporting compatibility, not claiming a project
 * opened - see describe-file-flow-state.ts's own doc comment: this app has
 * no browser Worker/OPFS driver wired in yet (Phase 3 built the driver and
 * the Worker-crash transport, but nothing in apps/web constructs one), so
 * "this file is safe to open" and "this file is now open" are different, true
 * statements and only the first one is honest to make here.
 */
export function FileOpenPanel(props: FileOpenPanelProps): JSX.Element {
  const { isOpen, onOpenChange } = props;
  const [state, setState] = useState<FileFlowState>({ kind: 'idle' });
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setState((current) => reduceFileFlow(current, { type: 'route-native' }));
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
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
      aria-label="Open project"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--arq-space-panel)',
          width: 480,
        }}
      >
        <h2 style={{ margin: 0, font: 'inherit', fontWeight: 600 }}>Open project</h2>
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a file to open, or drop it here"
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
        <div role="status" aria-live="polite">
          <p
            style={{
              margin: 0,
              fontWeight: description.tone === 'error' ? 600 : 400,
              color:
                description.tone === 'error' ? 'var(--arq-ui-ink)' : 'var(--arq-ui-text-primary)',
            }}
          >
            {busy && '⏳ '}
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
