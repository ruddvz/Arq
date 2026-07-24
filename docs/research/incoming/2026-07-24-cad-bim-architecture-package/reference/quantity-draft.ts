/**
 * A controlled quantity editor keeps an editable string separate from canonical
 * numeric data. It does not commit NaN, an incomplete value, or a value outside
 * the caller's domain while the user is still typing.
 */

export type LengthUnit = "m" | "cm" | "mm" | "ft" | "in";

export interface LengthQuantity {
  readonly meters: number;
  readonly displayUnit: LengthUnit;
}

export type LengthParseResult =
  | { readonly kind: "incomplete" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "complete"; readonly quantity: LengthQuantity };

const METRES_PER_UNIT: Readonly<Record<LengthUnit, number>> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

const LENGTH_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*(m|cm|mm|ft|in))?$/i;

export function parseLengthDraft(
  draft: string,
  fallbackUnit: LengthUnit,
): LengthParseResult {
  const normalized = draft.trim();
  if (!normalized || normalized === "+" || normalized === "-" || normalized === ".") {
    return { kind: "incomplete" };
  }

  const match = normalized.match(LENGTH_PATTERN);
  if (!match) {
    return { kind: "invalid", message: "Enter a finite length such as 2500 mm or 2.5 m." };
  }

  const numeric = Number(match[1]);
  const displayUnit = (match[2]?.toLowerCase() ?? fallbackUnit) as LengthUnit;
  const meters = numeric * METRES_PER_UNIT[displayUnit];
  if (!Number.isFinite(meters)) {
    return { kind: "invalid", message: "Length must be finite." };
  }

  return { kind: "complete", quantity: { meters, displayUnit } };
}

export class LengthDraft {
  private text: string;

  public constructor(
    initial: LengthQuantity,
    private readonly fallbackUnit: LengthUnit,
  ) {
    this.text = `${displayLength(initial.meters, initial.displayUnit)} ${initial.displayUnit}`;
  }

  public get value(): string {
    return this.text;
  }

  public set value(next: string) {
    this.text = next;
  }

  public parse(): LengthParseResult {
    return parseLengthDraft(this.text, this.fallbackUnit);
  }

  public commit(): LengthQuantity | undefined {
    const parsed = this.parse();
    return parsed.kind === "complete" ? parsed.quantity : undefined;
  }
}

function displayLength(meters: number, unit: LengthUnit): string {
  const value = meters / METRES_PER_UNIT[unit];
  return Number(value.toFixed(6)).toString();
}
