import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  createTextNote,
  sanitizeNoteText,
  textNoteHasControlledStyle,
  type CreateTextNoteInput,
} from './text-note';
import { length } from './length';
import { levelId, textNoteId } from './ids';

const baseInput: CreateTextNoteInput = {
  id: textNoteId('note-1'),
  levelId: levelId('level-1'),
  position: worldPoint(0, 0),
  text: 'Verify dimensions on site',
  styleId: 'note',
  width: length(2000, 'mm'),
};

describe('sanitizeNoteText', () => {
  it('leaves plain text unchanged', () => {
    expect(sanitizeNoteText('Verify dimensions on site')).toBe('Verify dimensions on site');
  });

  it('strips HTML/rich-text markup', () => {
    expect(sanitizeNoteText('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
  });

  it('keeps newline and tab characters', () => {
    expect(sanitizeNoteText('Line one\nLine two\tindented')).toBe('Line one\nLine two\tindented');
  });

  it('normalises CRLF and lone CR line endings to LF', () => {
    expect(sanitizeNoteText('one\r\ntwo\rthree\nfour')).toBe('one\ntwo\nthree\nfour');
  });

  it('strips non-printing control characters other than tab and newline', () => {
    const withControls = 'a' + String.fromCharCode(0, 7, 0x1f, 0x7f) + 'e';
    expect(sanitizeNoteText(withControls)).toBe('ae');
  });

  it('leaves ordinary punctuation and symbols untouched', () => {
    expect(sanitizeNoteText('Note: see detail 3 (typ.) — 45°')).toBe(
      'Note: see detail 3 (typ.) — 45°',
    );
  });
});

describe('createTextNote', () => {
  it('sanitises the given text on construction', () => {
    const note = createTextNote({ ...baseInput, text: '<b>Verify</b> on site' });
    expect(note.text).toBe('Verify on site');
  });

  it('defaults alignment to left', () => {
    expect(createTextNote(baseInput).alignment).toBe('left');
  });

  it('keeps a given alignment', () => {
    expect(createTextNote({ ...baseInput, alignment: 'center' }).alignment).toBe('center');
  });

  it('carries the given styleId and width through unchanged', () => {
    const note = createTextNote(baseInput);
    expect(note.styleId).toBe('note');
    expect(note.width).toEqual({ value: 2000, unit: 'mm' });
  });
});

describe('textNoteHasControlledStyle', () => {
  it('is true when the styleId is in the allowed catalog', () => {
    const note = createTextNote(baseInput);
    expect(textNoteHasControlledStyle(note, new Set(['note', 'title']))).toBe(true);
  });

  it('is false when the styleId is not in the allowed catalog', () => {
    const note = createTextNote({ ...baseInput, styleId: 'made-up-style' });
    expect(textNoteHasControlledStyle(note, new Set(['note', 'title']))).toBe(false);
  });

  it('is false against an empty catalog', () => {
    const note = createTextNote(baseInput);
    expect(textNoteHasControlledStyle(note, new Set())).toBe(false);
  });
});
