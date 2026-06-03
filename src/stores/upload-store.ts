import { create } from 'zustand';
import type { UploadProgress } from '../types';

interface UploadState {
  uploads: UploadProgress[];
  startUpload: (fileId: string, fileName: string, totalChunks: number) => void;
  updateProgress: (fileId: string, completedChunks: number, status?: UploadProgress['status']) => void;
  completeUpload: (fileId: string) => void;
  failUpload: (fileId: string, error: string) => void;
  removeUpload: (fileId: string) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  uploads: [],

  startUpload: (fileId, fileName, totalChunks) => {
    set(state => ({
      uploads: [...state.uploads, {
        fileId,
        fileName,
        totalChunks,
        completedChunks: 0,
        status: 'pending',
      }],
    }));
  },

  updateProgress: (fileId, completedChunks, status) => {
    set(state => ({
      uploads: state.uploads.map(u =>
        u.fileId === fileId
          ? { ...u, completedChunks, ...(status ? { status } : {}) }
          : u
      ),
    }));
  },

  completeUpload: (fileId) => {
    set(state => ({
      uploads: state.uploads.map(u =>
        u.fileId === fileId ? { ...u, status: 'complete', completedChunks: u.totalChunks } : u
      ),
    }));
  },

  failUpload: (fileId, error) => {
    set(state => ({
      uploads: state.uploads.map(u =>
        u.fileId === fileId ? { ...u, status: 'failed', error } : u
      ),
    }));
  },

  removeUpload: (fileId) => {
    set(state => ({
      uploads: state.uploads.filter(u => u.fileId !== fileId),
    }));
  },
}));
