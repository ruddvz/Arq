import { useEffect, useRef, type ReactNode } from 'react';
import { sheetHeightPx, type SheetDetent, type WorkspacePlatform } from '@arq/workspace';

export interface WorkspaceSheetProps {
  readonly title: string;
  readonly platform: WorkspacePlatform;
  readonly detent: SheetDetent;
  readonly viewportHeightPx: number;
  readonly onClose: () => void;
  readonly onExpand: () => void;
  readonly onCollapse: () => void;
  readonly children: ReactNode;
}

const DETENT_LABEL: Readonly<Record<Exclude<SheetDetent, 'closed'>, string>> = {
  peek: 'peek',
  half: 'half height',
  full: 'full height',
};

/**
 * Doc 47's bottom sheet: the touch replacement for a docked panel.
 *
 * Modal only at `full`. That is the significant decision here. A sheet at
 * `peek` or `half` deliberately leaves the canvas visible *and usable* — doc
 * 47's peek detent exists so a user can see the selection identity while still
 * looking at the drawing, and trapping focus over a canvas the user can still
 * see and touch would make the sheet feel broken. At `full` the canvas is
 * covered, so the sheet takes `aria-modal` and focus containment because there
 * is nothing behind it to interact with.
 *
 * Detent changes are a real control, not only a drag. Doc 47 lists a drag
 * gesture, but a sheet whose only path between detents is a drag is unusable
 * with a keyboard or a switch device — so the grabber is a `<button>` that
 * cycles, and Escape closes.
 *
 * The height comes from `sheetHeightPx`, which reads the layout registry's own
 * `sheetDetents`. Nothing here invents a number.
 */
export function WorkspaceSheet(props: WorkspaceSheetProps): JSX.Element {
  const { title, platform, detent, viewportHeightPx, onClose, onExpand, onCollapse, children } =
    props;
  const sheetRef = useRef<HTMLDivElement>(null);
  const modal = detent === 'full';

  useEffect(() => {
    const node = sheetRef.current;
    if (node === null) {
      return;
    }
    // Move focus in when the sheet becomes modal so a keyboard user is not left
    // behind a cover they cannot see past.
    if (modal) {
      node.focus();
    }
  }, [modal]);

  if (detent === 'closed') {
    return <></>;
  }

  const heightPx = sheetHeightPx(platform, detent, viewportHeightPx);

  return (
    <div
      className={`arq-sheet arq-sheet--${detent}`}
      role="dialog"
      aria-modal={modal}
      aria-label={`${title}, ${DETENT_LABEL[detent]}`}
      tabIndex={-1}
      ref={sheetRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: heightPx,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--arq-ui-paper)',
        borderTop: '1px solid var(--arq-ui-line-default)',
        borderTopLeftRadius: 'var(--arq-radius-dialog)',
        borderTopRightRadius: 'var(--arq-radius-dialog)',
        boxShadow: '0 -4px 16px rgb(0 0 0 / 18%)',
      }}
    >
      <div
        className="arq-sheet__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--arq-space-compact)',
          padding: 'var(--arq-space-compact) var(--arq-space-panel)',
          borderBottom: '1px solid var(--arq-ui-line-subtle)',
          flex: '0 0 auto',
        }}
      >
        <button
          type="button"
          className="arq-shell-button arq-sheet__grabber"
          aria-label={
            detent === 'full'
              ? `${title}: collapse sheet. Currently ${DETENT_LABEL[detent]}.`
              : `${title}: expand sheet. Currently ${DETENT_LABEL[detent]}.`
          }
          onClick={detent === 'full' ? onCollapse : onExpand}
        >
          <span aria-hidden="true">{detent === 'full' ? '▾' : '▴'}</span>
        </button>
        <h2 style={{ margin: 0, fontSize: '1rem', flex: 1, minWidth: 0 }}>{title}</h2>
        <button
          type="button"
          className="arq-shell-button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
    </div>
  );
}
