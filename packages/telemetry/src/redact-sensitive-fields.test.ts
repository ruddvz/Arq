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

  /**
   * The previous version declined to recurse into arrays and called it a
   * documented limitation. What it predictably did was leak: an event about
   * several things is an array of objects, which is where the sensitive fields
   * actually are.
   */
  describe('arrays', () => {
    it('redacts sensitive fields inside an array of objects', () => {
      const redacted = redactSensitiveFields({
        items: [{ projectName: 'Hillside Residence', durationMs: 42 }],
      });
      expect(redacted.items).toEqual([{ projectName: REDACTED_PLACEHOLDER, durationMs: 42 }]);
    });

    it('redacts through arrays nested in objects nested in arrays', () => {
      const redacted = redactSensitiveFields({
        sheets: [{ revisions: [{ sheetContent: 'A1.1 floor plan', revision: 3 }] }],
      });
      expect(redacted).toEqual({
        sheets: [{ revisions: [{ sheetContent: REDACTED_PLACEHOLDER, revision: 3 }] }],
      });
    });

    it('leaves arrays of primitives alone', () => {
      const event = { durationsMs: [1, 2, 3], tags: ['a', 'b'] };
      expect(redactSensitiveFields(event)).toEqual(event);
    });

    it('does not mutate the original array', () => {
      const event = { items: [{ projectName: 'Hillside Residence' }] };
      redactSensitiveFields(event);
      expect(event.items[0]?.projectName).toBe('Hillside Residence');
    });
  });

  /**
   * Telemetry payloads are assembled from API responses, database rows and
   * worker messages, which do not agree on a case convention. Matching one
   * spelling meant catching whichever the author happened to think of.
   */
  describe('field-name spellings', () => {
    it('redacts snake_case, kebab-case, PascalCase and upper-case spellings', () => {
      const event = {
        project_name: 'Hillside Residence',
        'client-name': 'Acme Studio',
        SheetContent: 'A1.1 floor plan',
        RAW_PROMPT: 'design a kitchen',
        Address: '123 Main St',
      };
      const redacted = redactSensitiveFields(event);
      for (const key of Object.keys(event)) {
        expect(redacted[key]).toBe(REDACTED_PLACEHOLDER);
      }
    });

    it('still collects fields that merely start with a sensitive name', () => {
      // Whole-key match, not substring: a count of walls is not the walls.
      const event = { geometryCount: 12, promptTokenCount: 40, addressBookSize: 3 };
      expect(redactSensitiveFields(event)).toEqual(event);
    });
  });

  it('returns an empty object for an empty event', () => {
    expect(redactSensitiveFields({})).toEqual({});
  });
});
