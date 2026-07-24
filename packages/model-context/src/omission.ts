import type { OmissionReference } from './types';
async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text) as BufferSource,
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function createOmissionReference(input: {
  projectRevision: number;
  query: string;
  result: string;
  permissionScope: string;
  omittedCount: number;
  summary: string;
}): Promise<OmissionReference> {
  const queryHash = await hash(input.query);
  const resultHash = await hash(input.result);
  return {
    ref: `arq-context#${resultHash.slice(0, 12)}`,
    projectRevision: input.projectRevision,
    queryHash,
    resultHash,
    createdAt: new Date().toISOString(),
    permissionScope: input.permissionScope,
    omittedCount: input.omittedCount,
    summary: input.summary,
  };
}
