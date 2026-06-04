import { create } from 'zustand';

interface SelectionState {
  selectedId: string | null;
  setSelected: (id: string | null) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),
  clear: () => set({ selectedId: null })
}));
