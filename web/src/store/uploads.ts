import { create } from 'zustand';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface UploadsState {
  items: UploadItem[];
  enqueue: (item: Omit<UploadItem, 'progress' | 'status' | 'error'>) => string;
  setStatus: (id: string, status: UploadStatus) => void;
  updateProgress: (id: string, progress: number) => void;
  markDone: (id: string) => void;
  markError: (id: string, error: string) => void;
  markCancelled: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
}

export const useUploadsStore = create<UploadsState>((set) => ({
  items: [],
  enqueue: ({ id, name, size }) => {
    set((state) => ({
      items: [
        ...state.items,
        { id, name, size, status: 'queued' as const, progress: 0 }
      ]
    }));
    return id;
  },
  setStatus: (id, status) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, status } : i))
    })),
  updateProgress: (id, progress) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, progress } : i))
    })),
  markDone: (id) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, status: 'done' as const, progress: 100 } : i))
    })),
  markError: (id, error) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, status: 'error' as const, error } : i))
    })),
  markCancelled: (id) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, status: 'cancelled' as const } : i))
    })),
  remove: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id)
    })),
  clearFinished: () =>
    set((state) => ({
      items: state.items.filter((i) => i.status === 'queued' || i.status === 'uploading')
    }))
}));
