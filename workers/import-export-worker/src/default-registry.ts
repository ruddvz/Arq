import { DxfIngressAdapter } from '@arq/dxf-adapter';
import { AdapterRegistry, AttachmentAdapter, UnderlayAdapter } from '@arq/file-ingress';

export function createDefaultIngressRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new AttachmentAdapter());
  registry.register(new UnderlayAdapter());
  registry.register(new DxfIngressAdapter());
  return registry;
}
