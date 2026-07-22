import { describe, expect, it } from 'vitest';
import {
  createVisibilityState,
  effectiveHiddenSet,
  exitIsolate,
  hideElements,
  isolateElements,
  showElements,
} from './visibility-state';

describe('createVisibilityState', () => {
  it('starts with nothing hidden and not isolating', () => {
    const state = createVisibilityState<string>();
    expect(state.hidden.size).toBe(0);
    expect(state.isolated).toBeNull();
  });
});

describe('hideElements / showElements', () => {
  it('adds ids to the hidden set', () => {
    const state = hideElements(createVisibilityState<string>(), ['a', 'b']);
    expect(state.hidden).toEqual(new Set(['a', 'b']));
  });

  it('is additive across multiple calls', () => {
    let state = createVisibilityState<string>();
    state = hideElements(state, ['a']);
    state = hideElements(state, ['b']);
    expect(state.hidden).toEqual(new Set(['a', 'b']));
  });

  it('removes ids from the hidden set', () => {
    let state = hideElements(createVisibilityState<string>(), ['a', 'b']);
    state = showElements(state, ['a']);
    expect(state.hidden).toEqual(new Set(['b']));
  });

  it('does not affect isolate state', () => {
    let state = isolateElements(createVisibilityState<string>(), ['a']);
    state = hideElements(state, ['b']);
    expect(state.isolated).toEqual(new Set(['a']));
  });
});

describe('isolateElements / exitIsolate', () => {
  it('sets the isolated set', () => {
    const state = isolateElements(createVisibilityState<string>(), ['a', 'b']);
    expect(state.isolated).toEqual(new Set(['a', 'b']));
  });

  it('replaces (does not merge with) a previous isolate set', () => {
    let state = isolateElements(createVisibilityState<string>(), ['a']);
    state = isolateElements(state, ['b']);
    expect(state.isolated).toEqual(new Set(['b']));
  });

  it('exitIsolate clears the isolated set', () => {
    let state = isolateElements(createVisibilityState<string>(), ['a']);
    state = exitIsolate(state);
    expect(state.isolated).toBeNull();
  });

  it('exitIsolate restores the hidden set exactly as it was before isolating, not empty', () => {
    let state = hideElements(createVisibilityState<string>(), ['reference-layer']);
    state = isolateElements(state, ['room-1']);
    state = exitIsolate(state);
    expect(state.hidden).toEqual(new Set(['reference-layer']));
  });

  it('exitIsolate is a no-op when not currently isolating', () => {
    const state = hideElements(createVisibilityState<string>(), ['a']);
    expect(exitIsolate(state)).toBe(state);
  });
});

describe('effectiveHiddenSet', () => {
  it('returns just the hidden set when not isolating', () => {
    const state = hideElements(createVisibilityState<string>(), ['a']);
    expect(effectiveHiddenSet(state, ['a', 'b', 'c'])).toEqual(new Set(['a']));
  });

  it('hides everything not in the isolated set while isolating', () => {
    const state = isolateElements(createVisibilityState<string>(), ['b']);
    expect(effectiveHiddenSet(state, ['a', 'b', 'c'])).toEqual(new Set(['a', 'c']));
  });

  it('combines the explicit hidden set with the isolate overlay', () => {
    let state = hideElements(createVisibilityState<string>(), ['a']);
    state = isolateElements(state, ['a', 'b']);
    // 'a' is both explicitly hidden and nominally isolated-visible - hidden wins.
    expect(effectiveHiddenSet(state, ['a', 'b', 'c'])).toEqual(new Set(['a', 'c']));
  });

  it('isolating everything leaves nothing hidden', () => {
    const state = isolateElements(createVisibilityState<string>(), ['a', 'b', 'c']);
    expect(effectiveHiddenSet(state, ['a', 'b', 'c'])).toEqual(new Set());
  });
});
