import wordmarkBlack from '../../../brand/01_VECTOR/ARQ_Wordmark_Black.svg';
import symbolBlack from '../../../brand/01_VECTOR/ARQ_Symbol_Black.svg';

/**
 * The real brand assets (brand/00_GUIDE/README.txt), not a placeholder: minimum
 * sizes are wordmark 64px/18mm, symbol 24px/7mm - enforced here via a floor on the
 * height prop rather than left to whatever a caller happens to pass.
 */
export type LogoVariant = 'wordmark' | 'symbol';

export interface LogoProps {
  readonly variant?: LogoVariant;
  /** Rendered height in px - floored at each variant's brand minimum. */
  readonly heightPx?: number;
  readonly className?: string;
}

const MINIMUM_HEIGHT_PX: Record<LogoVariant, number> = {
  wordmark: 64,
  symbol: 24,
};

const SOURCE_BY_VARIANT: Record<LogoVariant, string> = {
  wordmark: wordmarkBlack,
  symbol: symbolBlack,
};

export function Logo({ variant = 'wordmark', heightPx, className }: LogoProps): JSX.Element {
  const height = Math.max(heightPx ?? MINIMUM_HEIGHT_PX[variant], MINIMUM_HEIGHT_PX[variant]);
  return (
    <img
      src={SOURCE_BY_VARIANT[variant]}
      alt="Arq"
      height={height}
      {...(className !== undefined && { className })}
    />
  );
}
