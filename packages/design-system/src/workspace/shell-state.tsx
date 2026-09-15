import { useId, type ReactNode } from 'react';
import {
  describeDisabledState,
  shouldIgnoreActivation,
} from '../interaction-foundation/interaction';

export const SHELL_STATE_KINDS = [
  'empty',
  'loading',
  'unavailable',
  'read-only',
  'recoverable-error',
  'failure',
  'empty-panel',
] as const;

export type ShellStateKind = (typeof SHELL_STATE_KINDS)[number];

export type ShellStateAnnouncement = 'auto' | 'off' | 'polite' | 'assertive';

interface ShellStateActionBase {
  readonly label: string;
  /**
   * When supplied, the action stays keyboard reachable but activation is
   * suppressed and this reason is rendered visibly and through
   * aria-describedby. Capability/permission owners supply the reason; this
   * component never derives one.
   */
  readonly disabledReason?: string;
}

export interface ShellStateButtonAction extends ShellStateActionBase {
  readonly onAction: () => void;
  readonly href?: never;
}

export interface ShellStateLinkAction extends ShellStateActionBase {
  readonly href: string;
  readonly onAction?: never;
}

export type ShellStateAction = ShellStateButtonAction | ShellStateLinkAction;

interface ShellStateBaseProps {
  readonly title: string;
  readonly icon?: ReactNode;
  readonly primaryAction?: ShellStateAction;
  readonly secondaryAction?: ShellStateAction;
  readonly announcement?: ShellStateAnnouncement;
}

export type ShellStateProps =
  | (ShellStateBaseProps & {
      readonly kind: 'unavailable' | 'read-only';
      readonly description: string;
    })
  | (ShellStateBaseProps & {
      readonly kind: Exclude<ShellStateKind, 'unavailable' | 'read-only'>;
      readonly description?: string;
    });

export interface ShellStateSemantics {
  readonly role: 'group' | 'status' | 'alert';
  readonly live?: 'polite' | 'assertive';
  readonly atomic?: true;
}

/**
 * Presentation semantics only. The caller owns the truth represented by `kind`.
 * `auto` announces only states that are ordinarily transient or action-worthy;
 * static empty/restricted states stay quiet unless a caller explicitly opts in.
 */
export function resolveShellStateSemantics(
  kind: ShellStateKind,
  announcement: ShellStateAnnouncement = 'auto',
): ShellStateSemantics {
  const resolved =
    announcement === 'auto'
      ? kind === 'loading' || kind === 'recoverable-error'
        ? 'polite'
        : kind === 'failure'
          ? 'assertive'
          : 'off'
      : announcement;

  if (resolved === 'polite') {
    return { role: 'status', live: 'polite', atomic: true };
  }

  if (resolved === 'assertive') {
    return { role: 'alert', live: 'assertive', atomic: true };
  }

  return { role: 'group' };
}

function ShellStateActionControl(props: {
  readonly action: ShellStateAction;
  readonly primary: boolean;
}): JSX.Element {
  const { action, primary } = props;
  const className = primary ? 'arq-shell-button arq-shell-button--primary' : 'arq-shell-button';
  const reactId = useId().replace(/:/g, '');
  const disabledReason = action.disabledReason;

  if (disabledReason !== undefined && disabledReason.trim().length === 0) {
    throw new Error('a disabled shell-state action must provide a visible reason');
  }

  const reasonId =
    disabledReason === undefined ? undefined : `arq-shell-state-action-${reactId}-reason`;
  const disabledState = describeDisabledState({
    disabled: disabledReason !== undefined,
    reason: disabledReason ?? null,
    ...(reasonId === undefined ? {} : { reasonElementId: reasonId }),
  });
  const accessibilityProps = {
    'aria-disabled': disabledState.attributes['aria-disabled'],
    'aria-describedby': disabledState.attributes['aria-describedby'],
  };

  const control =
    action.href !== undefined ? (
      <a
        className={className}
        href={action.href}
        {...accessibilityProps}
        onClick={(event) => {
          if (shouldIgnoreActivation(disabledState)) {
            event.preventDefault();
          }
        }}
      >
        {action.label}
      </a>
    ) : (
      <button
        className={className}
        type="button"
        {...accessibilityProps}
        onClick={(event) => {
          if (shouldIgnoreActivation(disabledState)) {
            event.preventDefault();
            return;
          }
          action.onAction();
        }}
      >
        {action.label}
      </button>
    );

  return (
    <span className="arq-shell-state__action">
      {control}
      {disabledState.reasonText === null ? null : (
        <span id={reasonId} className="arq-shell-state__action-reason">
          {disabledState.reasonText}
        </span>
      )}
    </span>
  );
}

/**
 * One lightweight shell-state presentation surface. It never derives state from
 * project, permission, persistence, command or session data; callers supply the
 * state, copy and actions after their owning systems have made those decisions.
 * Unavailable and read-only states require visible explanatory copy. Message
 * fields are deliberately strings, and there is no exception/diagnostic input,
 * so the public API does not encourage passing raw runtime objects into UI.
 */
export function ShellState(props: ShellStateProps): JSX.Element {
  const {
    kind,
    title,
    description,
    icon,
    primaryAction,
    secondaryAction,
    announcement = 'auto',
  } = props;
  const reactId = useId().replace(/:/g, '');
  const titleId = `arq-shell-state-${reactId}-title`;
  const descriptionId =
    description === undefined ? undefined : `arq-shell-state-${reactId}-description`;
  const semantics = resolveShellStateSemantics(kind, announcement);
  const className =
    kind === 'empty-panel' ? 'arq-shell-state arq-shell-state--panel' : 'arq-shell-state';

  return (
    <div
      className={className}
      data-state-kind={kind}
      role={semantics.role}
      aria-live={semantics.live}
      aria-atomic={semantics.atomic}
      aria-busy={kind === 'loading' ? true : undefined}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="arq-shell-state__content">
        {icon === undefined ? null : (
          <span className="arq-shell-state__icon" aria-hidden="true">
            {icon}
          </span>
        )}

        <h2 id={titleId} className="arq-shell-state__title">
          {title}
        </h2>

        {description === undefined ? null : (
          <p id={descriptionId} className="arq-shell-state__description">
            {description}
          </p>
        )}

        {primaryAction === undefined && secondaryAction === undefined ? null : (
          <div className="arq-shell-state__actions">
            {primaryAction === undefined ? null : (
              <ShellStateActionControl action={primaryAction} primary />
            )}
            {secondaryAction === undefined ? null : (
              <ShellStateActionControl action={secondaryAction} primary={false} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
