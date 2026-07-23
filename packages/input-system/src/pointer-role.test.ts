import { describe, expect, it } from 'vitest';
import { classifyPointerInputRole, pointerRoleAllows, POINTER_ROLE_ACTIONS } from './pointer-role';

describe('classifyPointerInputRole', () => {
  it('classifies "pen" as pencil', () => {
    expect(classifyPointerInputRole('pen')).toBe('pencil');
  });

  it('classifies "touch" as finger', () => {
    expect(classifyPointerInputRole('touch')).toBe('finger');
  });

  it('classifies "mouse" as mouse', () => {
    expect(classifyPointerInputRole('mouse')).toBe('mouse');
  });

  it('defaults an unrecognized pointerType to mouse rather than throwing', () => {
    expect(classifyPointerInputRole('')).toBe('mouse');
    expect(classifyPointerInputRole('future-pointer-type')).toBe('mouse');
  });
});

describe('POINTER_ROLE_ACTIONS', () => {
  it("gives pencil exactly section 13's own list", () => {
    expect(POINTER_ROLE_ACTIONS.pencil).toEqual([
      'precise-point-selection',
      'drawing',
      'hover-preview',
      'handle-manipulation',
      'annotation',
      'contextual-tool-action',
    ]);
  });

  it("gives finger exactly section 13's own list", () => {
    expect(POINTER_ROLE_ACTIONS.finger).toEqual([
      'pan',
      'pinch-zoom',
      'orbit',
      'broad-selection',
      'interface-controls',
    ]);
  });

  it('gives mouse exactly section 13\'s own "keyboard and trackpad" list', () => {
    expect(POINTER_ROLE_ACTIONS.mouse).toEqual([
      'commands',
      'numeric-entry',
      'shortcuts',
      'precision-selection',
      'desktop-like-navigation',
    ]);
  });

  it('the three roles share no action in common - genuinely distinct interaction rules (section 11)', () => {
    const [pencil, finger, mouse] = [
      new Set(POINTER_ROLE_ACTIONS.pencil),
      new Set(POINTER_ROLE_ACTIONS.finger),
      new Set(POINTER_ROLE_ACTIONS.mouse),
    ];
    for (const action of pencil) {
      expect(finger.has(action)).toBe(false);
      expect(mouse.has(action)).toBe(false);
    }
    for (const action of finger) {
      expect(mouse.has(action)).toBe(false);
    }
  });
});

describe('pointerRoleAllows', () => {
  it('allows drawing for pencil but not for finger or mouse', () => {
    expect(pointerRoleAllows('pencil', 'drawing')).toBe(true);
    expect(pointerRoleAllows('finger', 'drawing')).toBe(false);
    expect(pointerRoleAllows('mouse', 'drawing')).toBe(false);
  });

  it('allows pinch-zoom for finger only', () => {
    expect(pointerRoleAllows('finger', 'pinch-zoom')).toBe(true);
    expect(pointerRoleAllows('pencil', 'pinch-zoom')).toBe(false);
    expect(pointerRoleAllows('mouse', 'pinch-zoom')).toBe(false);
  });

  it('allows numeric-entry for mouse/trackpad only', () => {
    expect(pointerRoleAllows('mouse', 'numeric-entry')).toBe(true);
    expect(pointerRoleAllows('pencil', 'numeric-entry')).toBe(false);
    expect(pointerRoleAllows('finger', 'numeric-entry')).toBe(false);
  });

  it('returns false for an action no role lists', () => {
    expect(pointerRoleAllows('pencil', 'squeeze')).toBe(false);
  });
});
