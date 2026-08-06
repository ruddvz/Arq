import type { ReactNode } from 'react';
import { Modal, ModalOverlay, Dialog } from 'react-aria-components';
import './modal-dialog.css';

export interface ArqModalDialogProps {
  readonly isOpen: boolean;
  /** Fires for every close path (Escape, outside click, explicit close) - see UI-003's "opener focus restoration for all close paths". */
  readonly onOpenChange: (isOpen: boolean) => void;
  /** Required unless the dialog has visible heading content associated via `aria-labelledby` on a child - an unlabelled dialog has no accessible name at all. */
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  /**
   * Whether clicking the backdrop closes the dialog. Defaults to true - most
   * confirmation/review dialogs are dismissable; a genuinely blocking dialog
   * (e.g. "resolve this before continuing") should pass `false` explicitly
   * rather than relying on a default that happens to block outside clicks.
   */
  readonly isDismissable?: boolean;
  readonly children: ReactNode | ((options: { readonly close: () => void }) => ReactNode);
}

/**
 * UI-001/UI-003: the shared modal/dialog primitive - React Aria's Modal+Dialog
 * give this for free, correctly, rather than each caller (command-palette.tsx
 * before this component existed, or any future confirmation/recovery/import
 * review dialog) reimplementing it by hand: a real focus trap while open, Tab
 * cannot escape into background content; Escape closes unless explicitly
 * disabled; outside click closes when `isDismissable`; focus returns to
 * whichever element opened the dialog on every close path, not just Escape;
 * background content becomes `inert` (unreachable by screen reader virtual
 * cursor, not merely visually covered).
 *
 * Deliberately controlled (`isOpen`/`onOpenChange`), not `DialogTrigger`'s
 * uncontrolled trigger-owns-state pattern: every existing shell component
 * (top-bar.tsx, command-palette.tsx, ...) already keeps open/closed state in
 * its own parent, matching this repository's "renderer/UI is a projection, the
 * caller owns state" convention - a caller-owned boolean is exactly what
 * `ModalOverlay`'s own controlled mode expects.
 */
export function ArqModalDialog(props: ArqModalDialogProps): JSX.Element {
  const { isOpen, onOpenChange, isDismissable = true, children, ...dialogAria } = props;
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className="arq-modal-overlay"
    >
      <Modal className="arq-modal">
        <Dialog className="arq-dialog arq-material" {...dialogAria}>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
