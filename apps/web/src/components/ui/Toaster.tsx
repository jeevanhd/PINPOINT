import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={16}
      toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: '13.5px',
        },
      }}
    />
  );
}
