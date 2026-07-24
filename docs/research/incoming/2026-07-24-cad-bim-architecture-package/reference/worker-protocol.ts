/**
 * A deliberately small protocol surface for the authoritative model worker.
 * Every message is serialisable. No native kernel handles, callbacks, DOM
 * objects, or renderer objects cross this boundary.
 */

export type ProtocolVersion = 1;
export type DocumentId = string;
export type RequestId = string;
export type TransactionId = string;
export type ElementId = string;
export type Revision = number;

export interface MessageEnvelope {
  readonly protocolVersion: ProtocolVersion;
  readonly documentId: DocumentId;
  readonly requestId: RequestId;
}

export type ModelCommand =
  | {
      readonly kind: "create-element";
      readonly element: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: "delete-element";
      readonly elementId: ElementId;
    }
  | {
      readonly kind: "set-parameter";
      readonly elementId: ElementId;
      readonly parameter: string;
      readonly value: unknown;
    }
  | {
      readonly kind: "move-placement";
      readonly elementId: ElementId;
      readonly placement: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: "attach-host";
      readonly childId: ElementId;
      readonly hostId: ElementId;
      readonly localPlacement: Readonly<Record<string, unknown>>;
    };

export interface MeshPacket {
  readonly geometryRevision: Revision;
  readonly renderOrigin: { readonly x: number; readonly y: number; readonly z: number };
  readonly positions: Float32Array;
  readonly normals?: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly elementIds: readonly ElementId[];
}

export type WorkerRequest =
  | (MessageEnvelope & {
      readonly kind: "apply-commands";
      readonly transactionId: TransactionId;
      readonly baseRevision: Revision;
      readonly commands: readonly ModelCommand[];
    })
  | (MessageEnvelope & {
      readonly kind: "undo";
      readonly baseRevision: Revision;
    })
  | (MessageEnvelope & {
      readonly kind: "redo";
      readonly baseRevision: Revision;
    })
  | (MessageEnvelope & {
      readonly kind: "request-render-packet";
      readonly revision: Revision;
      readonly viewKey: string;
    })
  | (MessageEnvelope & {
      readonly kind: "cancel-job";
      readonly jobId: string;
    });

export type DiagnosticCode =
  | "STALE_BASE_REVISION"
  | "VALIDATION_FAILED"
  | "CONSTRAINT_FAILED"
  | "CIRCULAR_DEPENDENCY"
  | "KERNEL_FAILED"
  | "CANCELLED"
  | "UNSUPPORTED";

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly elementIds?: readonly ElementId[];
  readonly details?: Readonly<Record<string, unknown>>;
}

export type WorkerResponse =
  | (MessageEnvelope & {
      readonly kind: "transaction-committed";
      readonly transactionId: TransactionId;
      readonly revision: Revision;
      readonly changedElementIds: readonly ElementId[];
      readonly invalidatedViews: readonly string[];
      readonly diagnostics: readonly Diagnostic[];
    })
  | (MessageEnvelope & {
      readonly kind: "transaction-rejected";
      readonly transactionId?: TransactionId;
      readonly currentRevision: Revision;
      readonly diagnostics: readonly Diagnostic[];
    })
  | (MessageEnvelope & {
      readonly kind: "render-packet";
      readonly revision: Revision;
      readonly viewKey: string;
      readonly packet: MeshPacket;
    })
  | (MessageEnvelope & {
      readonly kind: "job-progress";
      readonly jobId: string;
      readonly phase: string;
      readonly fraction?: number;
    })
  | (MessageEnvelope & {
      readonly kind: "job-cancelled";
      readonly jobId: string;
    });

/**
 * Supply this array as the postMessage transfer list for a completed mesh
 * packet. After transfer, the producing worker must not reuse these buffers.
 */
export function transferBuffersFor(response: WorkerResponse): ArrayBuffer[] {
  if (response.kind !== "render-packet") {
    return [];
  }

  const buffers: ArrayBuffer[] = [];
  const appendTransferableBuffer = (
    view: Float32Array | Uint16Array | Uint32Array,
  ): void => {
    const buffer = view.buffer;
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error(
        "Render packets sent through this transfer path must use ArrayBuffer, not shared memory.",
      );
    }
    buffers.push(buffer);
  };

  appendTransferableBuffer(response.packet.positions);
  appendTransferableBuffer(response.packet.indices);

  if (response.packet.normals) {
    appendTransferableBuffer(response.packet.normals);
  }

  return buffers;
}
