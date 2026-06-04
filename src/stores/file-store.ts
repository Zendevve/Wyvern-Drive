import { create } from 'zustand';
import type { FileRecord } from '../types';
import { getAllFiles, putFile, deleteFile as dbDeleteFile } from '../lib/db';

const WEBHOOK_URL_KEY = 'wyvern-webhook-url';

export function getWebhookUrl(): string | null {
  return localStorage.getItem(WEBHOOK_URL_KEY);
}

export function setWebhookUrl(url: string): void {
  localStorage.setItem(WEBHOOK_URL_KEY, url);
}

interface FileState {
  files: FileRecord[];
  currentFolderId: string | null;
  selectedFileId: string | null;
  viewMode: 'list' | 'grid';
  isLoading: boolean;
  loadFiles: () => Promise<void>;
  addFile: (file: FileRecord) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;
  setSelectedFileId: (id: string | null) => void;
  setViewMode: (mode: 'list' | 'grid') => void;
}

export const useFileStore = create<FileState>((set) => ({
  files: [],
  currentFolderId: null,
  selectedFileId: null,
  viewMode: 'grid',
  isLoading: false,

  loadFiles: async () => {
    set({ isLoading: true });
    const files = await getAllFiles();
    set({ files, isLoading: false });
  },

  addFile: async (file: FileRecord) => {
    await putFile(file);
    set(state => ({ files: [...state.files, file] }));
  },

  deleteFile: async (id: string) => {
    await dbDeleteFile(id);
    set(state => {
      const nextFiles = state.files.filter(f => f.id !== id);
      const nextSelected = state.selectedFileId === id ? null : state.selectedFileId;
      return { files: nextFiles, selectedFileId: nextSelected };
    });
  },

  setCurrentFolder: (folderId: string | null) => {
    set({ currentFolderId: folderId, selectedFileId: null });
  },

  setSelectedFileId: (id: string | null) => {
    set({ selectedFileId: id });
  },

  setViewMode: (mode: 'list' | 'grid') => {
    set({ viewMode: mode });
  },
}));
