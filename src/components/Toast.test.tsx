import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './Toast';

function TestComponent({ onToast }: { onToast?: () => void }) {
  const { toast } = useToast();
  return (
    <button onClick={() => { toast({ title: 'Test toast', variant: 'default' }); onToast?.(); }}>
      Show Toast
    </button>
  );
}

function SuccessToastComponent() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ title: 'Success!', variant: 'success' })}>
      Success
    </button>
  );
}

function ErrorToastComponent() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ title: 'Error!', variant: 'error', description: 'Something went wrong' })}>
      Error
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('renders toast when triggered', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test toast')).toBeDefined();
  });

  it('shows success variant', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <SuccessToastComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Success'));
    expect(screen.getByText('Success!')).toBeDefined();
  });

  it('shows error variant with description', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <ErrorToastComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Error'));
    expect(screen.getByText('Error!')).toBeDefined();
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('has role="status" and aria-live="polite" on container', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const container = screen.getByRole('status');
    expect(container.getAttribute('aria-live')).toBe('polite');
  });

  it('has role="alert" on individual toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Toast'));
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
  });
});
