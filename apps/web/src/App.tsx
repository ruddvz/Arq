import { Logo } from '@arq/design-system';
import { WallIcon, DoorIcon } from '@arq/icons';
import { PlanCanvas } from './PlanCanvas';

export function App(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid var(--arq-brand-foreground)',
          flexShrink: 0,
        }}
      >
        <Logo variant="symbol" heightPx={24} />
        <Logo variant="wordmark" heightPx={24} />
        <WallIcon width={20} height={20} aria-hidden="true" />
        <DoorIcon width={20} height={20} aria-hidden="true" />
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        <PlanCanvas />
      </main>
    </div>
  );
}
