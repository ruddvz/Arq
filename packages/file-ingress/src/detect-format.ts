import { FORMAT_DEFINITIONS } from './formats';
import { inspectNativeArqHeader } from './native-arq-header';
import type { FormatCandidate, InputFileDescriptor } from './types';

const decoder = new TextDecoder('utf-8', { fatal: false });

function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const index = base.lastIndexOf('.');
  return index < 0 ? '' : base.slice(index + 1).toLowerCase();
}

function hasAsciiPrefix(bytes: Uint8Array, text: string): boolean {
  const prefix = new TextEncoder().encode(text);
  if (bytes.byteLength < prefix.byteLength) return false;
  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
}

function candidate(
  formatId: string,
  confidence: number,
  evidence: readonly string[],
  extension: string,
): FormatCandidate {
  const definition = FORMAT_DEFINITIONS.find((item) => item.id === formatId);
  const extensionMismatch =
    extension.length > 0 &&
    definition !== undefined &&
    definition.extensions.length > 0 &&
    !definition.extensions.includes(extension);
  return { formatId, confidence, evidence, extensionMismatch };
}

export function detectFormat(
  bytes: Uint8Array,
  source: InputFileDescriptor,
): readonly FormatCandidate[] {
  const extension = extensionOf(source.name);
  const results: FormatCandidate[] = [];
  const header = bytes.subarray(0, Math.min(bytes.byteLength, 1_048_576));

  if (hasAsciiPrefix(header, 'SQLite format 3\0')) {
    const native = inspectNativeArqHeader(header);
    if (native.status === 'valid-arq-header') {
      results.push(candidate('arq-native', 1, ['SQLite header', 'Arq application ID'], extension));
    } else {
      results.push(candidate('sqlite-other', 0.99, ['SQLite header', native.code], extension));
    }
  }

  if (hasAsciiPrefix(header, '%PDF-'))
    results.push(candidate('pdf', 0.99, ['PDF signature'], extension));
  if (
    header.byteLength >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => header[i] === v)
  ) {
    results.push(candidate('png', 0.99, ['PNG signature'], extension));
  }
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    results.push(candidate('jpeg', 0.99, ['JPEG signature'], extension));
  }
  if (
    hasAsciiPrefix(header, 'RIFF') &&
    header.byteLength >= 12 &&
    decoder.decode(header.subarray(8, 12)) === 'WEBP'
  ) {
    results.push(candidate('webp', 0.99, ['RIFF/WEBP signature'], extension));
  }
  if (hasAsciiPrefix(header, 'glTF'))
    results.push(candidate('glb', 0.99, ['glTF binary signature'], extension));
  if (hasAsciiPrefix(header, 'ISO-10303-21;')) {
    const headText = decoder
      .decode(header.subarray(0, Math.min(header.byteLength, 8192)))
      .toUpperCase();
    results.push(
      candidate(
        headText.includes('IFC') ? 'ifc' : 'step',
        0.96,
        ['STEP physical-file signature'],
        extension,
      ),
    );
  }
  const headText = decoder.decode(header.subarray(0, Math.min(header.byteLength, 65_536)));
  if (
    /\bSECTION\b[\s\S]{0,256}\bHEADER\b/i.test(headText) ||
    /^\s*0\s*\r?\n\s*SECTION/m.test(headText)
  ) {
    results.push(candidate('dxf', 0.92, ['DXF section token probe'], extension));
  }
  if (/^AC10\d{2}/.test(headText))
    results.push(candidate('dwg', 0.98, ['DWG version signature'], extension));
  if (headText.startsWith('3D Geometry File Format'))
    results.push(candidate('3dm', 0.95, ['3DM header'], extension));
  if (/^\s*\{[\s\S]{0,2048}"asset"\s*:\s*\{/.test(headText)) {
    results.push(candidate('gltf', 0.85, ['glTF JSON asset probe'], extension));
  }

  if (results.length === 0 && extension.length > 0) {
    const byExtension = FORMAT_DEFINITIONS.find((item) => item.extensions.includes(extension));
    if (byExtension) results.push(candidate(byExtension.id, 0.35, ['extension only'], extension));
  }
  if (results.length === 0)
    results.push(candidate('unknown', 0.1, ['no trusted signature'], extension));

  return results.sort((left, right) => right.confidence - left.confidence);
}
