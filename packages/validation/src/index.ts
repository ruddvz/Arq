/**
 * §4.3 validation rules. This package holds cross-cutting geometry/model
 * rules; the ValidationMessage contract itself lives in @arq/operations
 * (validation-result.ts, ARQ-066) and per-operation rules (e.g. opening
 * overlaps) stay next to the operations they gate. A caller must refuse
 * to apply any operation whose messages contain errors - validation
 * itself never mutates anything.
 */
export * from './wall-segment-validation';
export * from './unique-id-validation';
export * from './room-polygon-validation';
