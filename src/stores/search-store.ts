import { create } from 'zustand';

interface SearchFilters {
  name: string;
  mimeType: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  folderId: string | null;
}

interface SearchState {
  query: string;
  filters: SearchFilters;
  setQuery: (q: string) => void;
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;
}

const defaultFilters: SearchFilters = {
  name: '', mimeType: '', dateFrom: null, dateTo: null, folderId: null,
};

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  filters: { ...defaultFilters },
  setQuery: (q) => set({ query: q }),
  setFilter: (key, value) => set(state => ({
    filters: { ...state.filters, [key]: value },
  })),
  clearFilters: () => set({ query: '', filters: { ...defaultFilters } }),
}));
