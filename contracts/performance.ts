export interface DeviceCapabilities {
  readonly input: readonly ('mouse' | 'keyboard' | 'touch' | 'pencil')[];
  readonly webGpu: boolean;
  readonly webGl2: boolean;
  readonly workerCount: number;
  readonly storageQuotaBytes?: number;
  readonly measuredPlanFrameMs: number;
  readonly measuredModelFrameMs?: number;
  readonly tier: 'A' | 'B' | 'C' | 'D';
}

export interface ProgressiveOpenStage {
  readonly stage:
    | 'header'
    | 'metadata'
    | 'first-view-index'
    | 'coarse-plan'
    | 'annotations'
    | 'detailed-plan'
    | 'model-mesh'
    | 'background-validation'
    | 'sync';
  readonly progress?: number;
  readonly cancellable: boolean;
}
