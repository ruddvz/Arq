/**
 * The application depends on a small desktop capability port, not directly on
 * Tauri globals. The web build supplies the safe fallback. A Tauri adapter can
 * be injected at bootstrap after its version, permissions, and capabilities
 * have been verified in the actual application.
 */

export type DesktopCapability =
  | 'fullscreen'
  | 'window-vibrancy'
  | 'native-file-dialog'
  | 'native-menu';

export interface NativeDesktopPort {
  readonly runtime: 'web' | 'tauri' | 'other';
  readonly capabilities: ReadonlySet<DesktopCapability>;
  toggleFullscreen(): Promise<void>;
}

export class WebDesktopPort implements NativeDesktopPort {
  public readonly runtime = 'web' as const;
  public readonly capabilities: ReadonlySet<DesktopCapability> = new Set(['fullscreen']);

  public async toggleFullscreen(): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const element = document.documentElement;
    if (!element.requestFullscreen) {
      throw new Error('Fullscreen is not supported by this web runtime.');
    }
    await element.requestFullscreen();
  }
}

export function hasCapability(port: NativeDesktopPort, capability: DesktopCapability): boolean {
  return port.capabilities.has(capability);
}
