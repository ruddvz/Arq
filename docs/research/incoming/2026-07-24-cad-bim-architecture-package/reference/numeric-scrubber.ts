/**
 * A numeric scrub session is transient UI state. Pointer movement produces
 * preview values only. The caller creates one semantic command after commit,
 * and creates no command after cancel.
 */

export type ScrubPrecision = 'fine' | 'normal' | 'coarse';

export interface NumericDomain {
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly pixelsPerStep?: number;
}

export interface ScrubPreview {
  readonly value: number;
  readonly changed: boolean;
}

export class NumericScrubSession {
  private readonly initialValue: number;
  private ended = false;

  public constructor(
    initialValue: number,
    private readonly pointerStartX: number,
    private readonly domain: NumericDomain,
  ) {
    validateDomain(domain);
    if (!Number.isFinite(initialValue)) {
      throw new Error('initialValue must be finite.');
    }
    this.initialValue = quantizeAndClamp(initialValue, domain);
  }

  public previewAt(pointerX: number, precision: ScrubPrecision = 'normal'): ScrubPreview {
    this.assertActive();
    if (!Number.isFinite(pointerX)) {
      throw new Error('pointerX must be finite.');
    }

    const pixelsPerStep = this.domain.pixelsPerStep ?? 8;
    const effectiveStep = this.domain.step * precisionMultiplier(precision);
    const deltaSteps = Math.round((pointerX - this.pointerStartX) / pixelsPerStep);
    const value = quantizeAndClampWithStep(
      this.initialValue + deltaSteps * effectiveStep,
      this.domain,
      effectiveStep,
    );

    return { value, changed: value !== this.initialValue };
  }

  public commitAt(pointerX: number, precision: ScrubPrecision = 'normal'): number {
    const value = this.previewAt(pointerX, precision).value;
    this.ended = true;
    return value;
  }

  public cancel(): number {
    this.assertActive();
    this.ended = true;
    return this.initialValue;
  }

  private assertActive(): void {
    if (this.ended) {
      throw new Error('The scrub session has already ended.');
    }
  }
}

export function quantizeAndClamp(value: number, domain: NumericDomain): number {
  return quantizeAndClampWithStep(value, domain, domain.step);
}

function quantizeAndClampWithStep(value: number, domain: NumericDomain, step: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('value must be finite.');
  }
  validateDomain(domain);
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error('Numeric quantization step must be finite and positive.');
  }
  const rawSteps = (value - domain.minimum) / step;
  const quantized = domain.minimum + Math.round(rawSteps) * step;
  const bounded = Math.min(domain.maximum, Math.max(domain.minimum, quantized));
  return roundForStep(bounded, step);
}

function precisionMultiplier(precision: ScrubPrecision): number {
  switch (precision) {
    case 'fine':
      return 0.1;
    case 'normal':
      return 1;
    case 'coarse':
      return 10;
  }
}

function validateDomain(domain: NumericDomain): void {
  if (!Number.isFinite(domain.minimum) || !Number.isFinite(domain.maximum)) {
    throw new Error('Numeric domain bounds must be finite.');
  }
  if (domain.minimum > domain.maximum) {
    throw new Error('Numeric domain minimum cannot exceed maximum.');
  }
  if (!Number.isFinite(domain.step) || domain.step <= 0) {
    throw new Error('Numeric domain step must be finite and positive.');
  }
  if (
    domain.pixelsPerStep !== undefined &&
    (!Number.isFinite(domain.pixelsPerStep) || domain.pixelsPerStep <= 0)
  ) {
    throw new Error('pixelsPerStep must be finite and positive when provided.');
  }
}

function roundForStep(value: number, step: number): number {
  const decimals = Math.min(12, Math.max(0, Math.ceil(-Math.log10(step)) + 2));
  return Number(value.toFixed(decimals));
}
