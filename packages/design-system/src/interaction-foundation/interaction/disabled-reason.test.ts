import { describe, expect, it } from 'vitest';
import {
  describeDisabledState,
  readOnlyDisabledReason,
  shouldIgnoreActivation,
} from './disabled-reason';

describe('describeDisabledState', () => {
  it('adds nothing to an enabled control', () => {
    const description = describeDisabledState({ disabled: false, reason: null });

    expect(description.attributes).toEqual({});
    expect(description.mustSuppressActivation).toBe(false);
  });

  it('keeps a control with a reason focusable, so the reason can be heard', () => {
    // The native disabled attribute removes an element from the tab order: a
    // keyboard user tabs past it and never learns why it cannot be used.
    const description = describeDisabledState({
      disabled: true,
      reason: 'This project is open for reading only.',
      reasonElementId: 'wall-tool-reason',
    });

    expect(description.attributes['aria-disabled']).toBe(true);
    expect(description.attributes.disabled).toBeUndefined();
    expect(description.attributes.tabIndex).toBeUndefined();
  });

  it('points at the element that renders the reason', () => {
    const description = describeDisabledState({
      disabled: true,
      reason: 'No level is selected.',
      reasonElementId: 'wall-tool-reason',
    });

    expect(description.attributes['aria-describedby']).toBe('wall-tool-reason');
    expect(description.reasonText).toBe('No level is selected.');
  });

  it('reports that activation is now the caller obligation', () => {
    // The browser stopped blocking it the moment aria-disabled was chosen. A
    // caller that ignores this ships a button that looks disabled and works.
    const description = describeDisabledState({
      disabled: true,
      reason: 'No level is selected.',
      reasonElementId: 'r',
    });

    expect(description.mustSuppressActivation).toBe(true);
    expect(shouldIgnoreActivation(description)).toBe(true);
  });

  it('uses the native attribute when there is genuinely nothing to announce', () => {
    // Making something focusable to announce nothing is worse than skipping it.
    const description = describeDisabledState({ disabled: true, reason: null });

    expect(description.attributes).toEqual({ disabled: true });
    expect(description.mustSuppressActivation).toBe(false);
    expect(description.reasonText).toBeNull();
  });

  it('treats a blank reason as no reason rather than as an empty description', () => {
    const description = describeDisabledState({ disabled: true, reason: '   ' });

    expect(description.attributes).toEqual({ disabled: true });
  });

  it('refuses a reason with nothing pointing at it', () => {
    // A generated default would aim aria-describedby at an element the caller
    // never renders, which reads as no description at all - silently.
    expect(() => describeDisabledState({ disabled: true, reason: 'Because.' })).toThrow(
      /must name the element/,
    );
  });

  it('does not suppress activation for an enabled control', () => {
    expect(shouldIgnoreActivation(describeDisabledState({ disabled: false, reason: null }))).toBe(
      false,
    );
  });
});

describe('readOnlyDisabledReason', () => {
  it('describes the project rather than the button', () => {
    // "Editing is disabled" tells a user their software is broken; this tells
    // them what is true.
    expect(readOnlyDisabledReason()).toBe('This project is open for reading only.');
  });

  it('appends a caller detail without rewriting the state', () => {
    expect(readOnlyDisabledReason('Another window has it open for editing.')).toBe(
      'This project is open for reading only. Another window has it open for editing.',
    );
  });
});
