/**
 * Minimal HTML templating with escaping-by-construction.
 *
 * Every interpolated value in the `html` tagged template is escaped unless it
 * is already a `SafeHtml` produced by `html` itself or wrapped in `raw()`.
 * Page content therefore cannot accidentally inject markup - the same
 * safe-by-default posture the product's copy principles ask of error text:
 * what you wrote is what renders.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/** Marker class so templates can distinguish rendered HTML from plain text. */
export class SafeHtml {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return this.value;
  }
}

/** Wrap a string that is already valid, trusted HTML (e.g. an inline SVG). */
export function raw(value: string): SafeHtml {
  return new SafeHtml(value);
}

type Interpolation =
  string | number | SafeHtml | readonly (string | number | SafeHtml)[] | null | undefined;

function renderValue(value: Interpolation): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof SafeHtml) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => renderValue(entry as Interpolation)).join('');
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return escapeHtml(value as string);
}

export function html(strings: TemplateStringsArray, ...values: readonly Interpolation[]): SafeHtml {
  let out = '';
  for (let i = 0; i < strings.length; i += 1) {
    out += strings[i] ?? '';
    if (i < values.length) {
      out += renderValue(values[i]);
    }
  }
  return new SafeHtml(out);
}
