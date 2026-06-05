import { create } from 'zustand';
import { type QueueOperation } from '../lib/queueDb';

interface QueueState {
  operations: QueueOperation[];
  isPaused: boolean;
  setOperations: (ops: QueueOperation[]) => void;
  addOperation: (op: QueueOperation) => void;
  updateOperationState: (id: string, updates: Partial<QueueOperation>) => void;
  removeOperation: (id: string) => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  operations: [],
  isPaused: false,
  setOperations: (operations) => set({ operations }),
  addOperation: (op) =>
    set((state) => ({
      operations: [...state.operations.filter((o) => o.id !== op.id), op].sort(
        (a, b) => a.created_at - b.created_at
      )
    })),
  updateOperationState: (id, updates) =>
    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, ...updates, updated_at: Date.now() } : op
      )
    })),
  removeOperation: (id) =>
    set((state) => ({
      operations: state.operations.filter((op) => op.id !== id)
    })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setPaused: (paused) => set({ isPaused: paused })
}));
