export interface FormatDefinition {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly adapterId: string;
  readonly route: 'native' | 'adapter' | 'underlay' | 'bridge' | 'attachment';
}

export const FORMAT_DEFINITIONS: readonly FormatDefinition[] = [
  { id: 'arq-native', extensions: ['arq'], adapterId: 'native-arq', route: 'native' },
  { id: 'arqpack', extensions: ['arqpack'], adapterId: 'arqpack-import', route: 'adapter' },
  { id: 'dxf', extensions: ['dxf'], adapterId: 'dxf-ingress', route: 'adapter' },
  { id: 'ifc', extensions: ['ifc', 'ifczip'], adapterId: 'ifc-ingress', route: 'adapter' },
  { id: 'pdf', extensions: ['pdf'], adapterId: 'underlay', route: 'underlay' },
  { id: 'png', extensions: ['png'], adapterId: 'underlay', route: 'underlay' },
  { id: 'jpeg', extensions: ['jpg', 'jpeg'], adapterId: 'underlay', route: 'underlay' },
  { id: 'webp', extensions: ['webp'], adapterId: 'underlay', route: 'underlay' },
  { id: 'dwg', extensions: ['dwg'], adapterId: 'licensed-bridge', route: 'bridge' },
  { id: 'rvt', extensions: ['rvt'], adapterId: 'licensed-bridge', route: 'bridge' },
  { id: 'skp', extensions: ['skp'], adapterId: 'licensed-bridge', route: 'bridge' },
  { id: '3dm', extensions: ['3dm'], adapterId: 'geometry-bridge', route: 'bridge' },
  { id: 'glb', extensions: ['glb'], adapterId: 'mesh-reference', route: 'adapter' },
  { id: 'gltf', extensions: ['gltf'], adapterId: 'mesh-reference', route: 'adapter' },
  { id: 'obj', extensions: ['obj'], adapterId: 'mesh-reference', route: 'adapter' },
  { id: 'stl', extensions: ['stl'], adapterId: 'mesh-reference', route: 'adapter' },
  { id: 'step', extensions: ['step', 'stp'], adapterId: 'geometry-kernel', route: 'bridge' },
  { id: 'iges', extensions: ['iges', 'igs'], adapterId: 'geometry-kernel', route: 'bridge' },
  { id: 'unknown', extensions: [], adapterId: 'attachment', route: 'attachment' },
];

export function formatById(id: string): FormatDefinition | undefined {
  return FORMAT_DEFINITIONS.find((format) => format.id === id);
}
