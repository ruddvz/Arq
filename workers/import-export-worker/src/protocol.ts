import type {
  ImportAdapterResult,
  ImportProgress,
  InputFileDescriptor,
  SerializableImportPolicy,
} from '@arq/file-ingress';

export type ImportWorkerRequest =
  | {
      readonly type: 'detect';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
      readonly source: InputFileDescriptor;
    }
  | {
      readonly type: 'convert';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
      readonly source: InputFileDescriptor;
      readonly expectedSourceSha256?: string;
      readonly formatId: string;
      readonly adapterId: string;
      readonly policy: SerializableImportPolicy;
    }
  | { readonly type: 'cancel'; readonly requestId: string };

export type ImportWorkerResponse =
  | { readonly type: 'progress'; readonly requestId: string; readonly progress: ImportProgress }
  | {
      readonly type: 'detected';
      readonly requestId: string;
      readonly candidates: readonly {
        readonly formatId: string;
        readonly confidence: number;
        readonly evidence: readonly string[];
        readonly extensionMismatch: boolean;
      }[];
    }
  | { readonly type: 'converted'; readonly requestId: string; readonly result: ImportAdapterResult }
  | { readonly type: 'cancelled'; readonly requestId: string }
  | {
      readonly type: 'failed';
      readonly requestId: string;
      readonly code: string;
      readonly message: string;
    };
