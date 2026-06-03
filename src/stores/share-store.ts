import { create } from 'zustand';
import type { ShareRecord } from '../types';
import { putShare, getAllShares, deleteShare } from '../lib/db';

interface ShareState {
  shares: ShareRecord[];
  isLoading: boolean;
  loadShares: () => Promise<void>;
  addShare: (share: ShareRecord) => Promise<void>;
  removeShare: (id: string) => Promise<void>;
  getSharesForFile: (fileId: string) => ShareRecord[];
  isExpired: (share: ShareRecord) => boolean;
}

export const useShareStore = create<ShareState>((set, get) => ({
  shares: [],
  isLoading: false,

  loadShares: async () => {
    set({ isLoading: true });
    const shares = await getAllShares();
    set({ shares, isLoading: false });
  },

  addShare: async (share) => {
    await putShare(share);
    set(state => ({ shares: [...state.shares, share] }));
  },

  removeShare: async (id) => {
    await deleteShare(id);
    set(state => ({ shares: state.shares.filter(s => s.id !== id) }));
  },

  getSharesForFile: (fileId) => {
    return get().shares.filter(s => s.fileId === fileId);
  },

  isExpired: (share) => {
    return share.expiresAt > 0 && Date.now() > share.expiresAt;
  },
}));
