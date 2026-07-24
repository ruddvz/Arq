import { canonicalJson, sha256Hex } from './canonical';

export interface EngineFingerprintInput {
  readonly operationSchema: string;
  readonly geometryAlgorithms: Readonly<Record<string, string>>;
  readonly projectionAlgorithms: Readonly<Record<string, string>>;
  readonly tolerancePolicy: string;
  readonly styleSchema: string;
  readonly cacheRecordSchema: string;
  readonly capabilityVersion?: string;
}

export function buildEngineFingerprintMaterial(input: EngineFingerprintInput): string {
  return canonicalJson(input);
}

export async function computeEngineFingerprint(input: EngineFingerprintInput): Promise<string> {
  return sha256Hex(buildEngineFingerprintMaterial(input));
}
