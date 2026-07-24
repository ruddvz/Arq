import { describe, expect, it } from 'vitest';
import { AdapterRegistry } from './adapter-registry';
import { AttachmentAdapter } from './attachment-adapter';
import { UnderlayAdapter } from './underlay-adapter';

describe('AdapterRegistry', () => {
  it('resolves an adapter by one of its declared format ids', () => {
    const registry = new AdapterRegistry();
    const underlay = new UnderlayAdapter();
    registry.register(underlay);

    expect(registry.resolve('pdf')).toBe(underlay);
    expect(registry.resolve('png')).toBe(underlay);
  });

  it('returns undefined for a format no registered adapter declares', () => {
    const registry = new AdapterRegistry();
    registry.register(new UnderlayAdapter());

    expect(registry.resolve('dxf')).toBeUndefined();
  });

  it('gets a registered adapter by its own id', () => {
    const registry = new AdapterRegistry();
    const attachment = new AttachmentAdapter();
    registry.register(attachment);

    expect(registry.get('attachment')).toBe(attachment);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects registering the same adapter id twice', () => {
    const registry = new AdapterRegistry();
    registry.register(new AttachmentAdapter());

    expect(() => registry.register(new AttachmentAdapter())).toThrow(/already registered/);
  });

  it('lists every registered adapter', () => {
    const registry = new AdapterRegistry();
    const attachment = new AttachmentAdapter();
    const underlay = new UnderlayAdapter();
    registry.register(attachment);
    registry.register(underlay);

    expect(registry.list()).toEqual([attachment, underlay]);
  });
});
