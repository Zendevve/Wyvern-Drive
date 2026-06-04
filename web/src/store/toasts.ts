import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  lifetimeMs: number;
}

interface ToastsState {
  toasts: Toast[];
  push: (toast: { kind?: ToastKind; message: string; lifetimeMs?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastsStore = create<ToastsState>((set, get) => ({
  toasts: [],
  push: ({ kind = 'info', message, lifetimeMs = 4000 }) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, kind, message, lifetimeMs }] }));
    if (lifetimeMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => get().dismiss(id), lifetimeMs);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));
