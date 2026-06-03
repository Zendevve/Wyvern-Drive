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
  isLoading: boolean;
  loadFiles: () => Promise<void>;
  addFile: (file: FileRecord) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;
}

export const useFileStore = create<FileState>((set) => ({
  files: [],
  currentFolderId: null,
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
    set(state => ({ files: state.files.filter(f => f.id !== id) }));
  },

  setCurrentFolder: (folderId: string | null) => {
    set({ currentFolderId: folderId });
  },
}));
