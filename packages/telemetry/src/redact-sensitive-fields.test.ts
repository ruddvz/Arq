import { describe, expect, it } from 'vitest';
import { redactSensitiveFields, REDACTED_PLACEHOLDER } from './redact-sensitive-fields';

describe('redactSensitiveFields', () => {
  it('redacts every section 118 "do not collect by default" field', () => {
    const event = {
      geometry: { points: [1, 2, 3] },
      projectName: 'Hillside Residence',
      address: '123 Main St',
      rawPrompt: 'design a kitchen',
      prompt: 'design a kitchen',
      sheetContent: 'A1.1 floor plan',
      clientName: 'Acme Studio',
    };
    const redacted = redactSensitiveFields(event);
    for (const key of Object.keys(event)) {
      expect(redacted[key]).toBe(REDACTED_PLACEHOLDER);
    }
  });

  it('leaves non-sensitive fields unchanged', () => {
    const event = { eventName: 'wall_created', durationMs: 42, sheetCount: 3 };
    expect(redactSensitiveFields(event)).toEqual(event);
  });

  it('redacts sensitive fields nested inside a plain-object payload', () => {
    const event = {
      eventName: 'export_completed',
      payload: { projectName: 'Hillside Residence', durationMs: 42 },
    };
    const redacted = redactSensitiveFields(event);
    expect(redacted).toEqual({
      eventName: 'export_completed',
      payload: { projectName: REDACTED_PLACEHOLDER, durationMs: 42 },
    });
  });

  it('does not mutate the original event object', () => {
    const event = { projectName: 'Hillside Residence', durationMs: 42 };
    const original = { ...event };
    redactSensitiveFields(event);
    expect(event).toEqual(original);
  });

  it('does not attempt to redact inside arrays (documented limitation, not a general deep sanitiser)', () => {
    const event = { items: [{ projectName: 'Hillside Residence' }] };
    const redacted = redactSensitiveFields(event);
    expect(redacted.items).toEqual(event.items);
  });

  it('returns an empty object for an empty event', () => {
    expect(redactSensitiveFields({})).toEqual({});
  });
});
