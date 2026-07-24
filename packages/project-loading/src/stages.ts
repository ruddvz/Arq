import type { OpenStage, StageDescriptor } from './types';
export const OPEN_STAGES: readonly StageDescriptor[] = [
  { stage: 0, name: 'Identify', blocking: true, capability: 'safe routing' },
  { stage: 1, name: 'Shell', blocking: true, capability: 'editor shell visible' },
  { stage: 2, name: 'Skeleton', blocking: true, capability: 'pan and zoom' },
  { stage: 3, name: 'Authoring', blocking: true, capability: 'protected authoring enabled' },
  { stage: 4, name: 'Quality', blocking: false, capability: 'full visual quality' },
  { stage: 5, name: 'Intelligence', blocking: false, capability: 'deferred advanced features' },
];
export function descriptor(stage: OpenStage): StageDescriptor {
  const value = OPEN_STAGES.find((item) => item.stage === stage);
  if (!value) throw new Error(`unknown open stage ${stage}`);
  return value;
}
