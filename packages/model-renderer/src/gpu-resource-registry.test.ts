import { describe, expect, it, vi } from 'vitest';
import { createGpuResourceRegistry } from './gpu-resource-registry';

describe('createGpuResourceRegistry', () => {
  it('disposes everything an owner holds when the project closes', () => {
    const registry = createGpuResourceRegistry();
    const geometry = vi.fn();
    const texture = vi.fn();

    registry.register('project-1', 'wall-geometry', geometry);
    registry.register('project-1', 'material-texture', texture);

    const report = registry.closeOwner('project-1');

    expect(geometry).toHaveBeenCalledOnce();
    expect(texture).toHaveBeenCalledOnce();
    expect(report).toEqual({ disposed: 2, failures: [] });
    expect(registry.outstanding('project-1')).toBe(0);
  });

  it('disposes newest first, so nothing frees a dependency before its dependent', () => {
    const registry = createGpuResourceRegistry();
    const order: string[] = [];

    registry.register('project-1', 'geometry', () => order.push('geometry'));
    registry.register('project-1', 'mesh', () => order.push('mesh'));

    registry.closeOwner('project-1');

    expect(order).toEqual(['mesh', 'geometry']);
  });

  it('leaves another project untouched', () => {
    const registry = createGpuResourceRegistry();
    const other = vi.fn();

    registry.register('project-1', 'a', vi.fn());
    registry.register('project-2', 'b', other);

    registry.closeOwner('project-1');

    expect(other).not.toHaveBeenCalled();
    expect(registry.outstanding('project-2')).toBe(1);
  });

  it('disposes a resource registered after close, rather than accepting or dropping it', () => {
    // A worker mesh build returning after its project closed would otherwise
    // register buffers with a registry nobody drains again.
    const registry = createGpuResourceRegistry();
    registry.closeOwner('project-1');
    const late = vi.fn();

    const handle = registry.register('project-1', 'late-mesh', late);

    expect(late).toHaveBeenCalledOnce();
    expect(handle.disposed).toBe(true);
    expect(registry.outstanding('project-1')).toBe(0);
  });

  it('keeps disposing after one disposer throws', () => {
    const registry = createGpuResourceRegistry();
    const after = vi.fn();
    const error = new Error('driver refused');

    registry.register('project-1', 'good', after);
    registry.register('project-1', 'bad', () => {
      throw error;
    });

    const report = registry.closeOwner('project-1');

    // One driver error must not strand every allocation behind it.
    expect(after).toHaveBeenCalledOnce();
    expect(report.disposed).toBe(1);
    expect(report.failures).toEqual([{ owner: 'project-1', label: 'bad', error }]);
  });

  it('disposes an individual resource exactly once', () => {
    const registry = createGpuResourceRegistry();
    const dispose = vi.fn();

    const handle = registry.register('project-1', 'geometry', dispose);
    handle.dispose();
    handle.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(handle.disposed).toBe(true);
  });

  it('does not dispose a resource twice when it was released before the close', () => {
    // Freeing an already-freed handle is undefined at best.
    const registry = createGpuResourceRegistry();
    const dispose = vi.fn();

    registry.register('project-1', 'geometry', dispose).dispose();
    const report = registry.closeOwner('project-1');

    expect(dispose).toHaveBeenCalledOnce();
    expect(report.disposed).toBe(0);
  });

  it('does not leave an entry behind when a disposer throws mid-handle', () => {
    const registry = createGpuResourceRegistry();
    const handle = registry.register('project-1', 'geometry', () => {
      throw new Error('driver refused');
    });

    expect(() => handle.dispose()).toThrow('driver refused');
    // Removed before the disposer ran, so the drain cannot free it again.
    expect(registry.outstanding('project-1')).toBe(0);
    expect(registry.closeOwner('project-1').disposed).toBe(0);
  });

  it('names owners that still hold resources, so a diagnostics panel can report a leak', () => {
    const registry = createGpuResourceRegistry();

    registry.register('project-1', 'a', vi.fn());
    registry.register('project-2', 'b', vi.fn());
    registry.closeOwner('project-1');

    expect(registry.owners()).toEqual(['project-2']);
  });

  it('closing an owner that holds nothing is not an error', () => {
    const registry = createGpuResourceRegistry();

    expect(registry.closeOwner('never-opened')).toEqual({ disposed: 0, failures: [] });
  });

  it('lets a project id be opened again once its resources are gone', () => {
    const registry = createGpuResourceRegistry();
    registry.register('project-1', 'a', vi.fn());
    registry.closeOwner('project-1');

    registry.reopenOwner('project-1');
    const dispose = vi.fn();
    const handle = registry.register('project-1', 'b', dispose);

    expect(registry.isClosed('project-1')).toBe(false);
    expect(handle.disposed).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
    expect(registry.outstanding('project-1')).toBe(1);
  });

  it('refuses to reopen over live resources, which would hide two generations under one key', () => {
    const registry = createGpuResourceRegistry();
    registry.register('project-1', 'a', vi.fn());

    expect(() => registry.reopenOwner('project-1')).toThrow(/still holds 1 resources/);
  });
});
