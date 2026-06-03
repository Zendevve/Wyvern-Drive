import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { FolderRecord } from '../types';
import {
  putFolder, getAllFolders,
  deleteFolder as dbDeleteFolder, getFolderPath as dbGetFolderPath
} from '../lib/db';

interface FolderState {
  folders: FolderRecord[];
  currentFolderId: string | null;
  isLoading: boolean;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<FolderRecord>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string | null) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;
  getFolderPath: () => Promise<FolderRecord[]>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  currentFolderId: null,
  isLoading: false,

  loadFolders: async () => {
    set({ isLoading: true });
    const folders = await getAllFolders();
    set({ folders, isLoading: false });
  },

  createFolder: async (name: string) => {
    const { currentFolderId, folders } = get();
    const parentPath = currentFolderId
      ? folders.find(f => f.id === currentFolderId)?.path ?? ''
      : '';
    const folder: FolderRecord = {
      id: uuidv4(),
      name,
      parentId: currentFolderId,
      path: parentPath ? `${parentPath}/${name}` : name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await putFolder(folder);
    set(state => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  renameFolder: async (id: string, name: string) => {
    const folder = get().folders.find(f => f.id === id);
    if (!folder) return;
    const updated = { ...folder, name, updatedAt: new Date() };
    if (folder.parentId) {
      const parent = get().folders.find(f => f.id === folder.parentId);
      updated.path = parent ? `${parent.path}/${name}` : name;
    } else {
      updated.path = name;
    }
    await putFolder(updated);
    set(state => ({
      folders: state.folders.map(f => f.id === id ? updated : f),
    }));
  },

  deleteFolder: async (id: string) => {
    await dbDeleteFolder(id);
    set(state => ({
      folders: state.folders.filter(f => f.id !== id),
    }));
  },

  moveFolder: async (id: string, newParentId: string | null) => {
    const folder = get().folders.find(f => f.id === id);
    if (!folder) return;
    const updated = { ...folder, parentId: newParentId, updatedAt: new Date() };
    const parentPath = newParentId
      ? get().folders.find(f => f.id === newParentId)?.path ?? ''
      : '';
    updated.path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    await putFolder(updated);
    set(state => ({
      folders: state.folders.map(f => f.id === id ? updated : f),
    }));
  },

  setCurrentFolder: (folderId: string | null) => {
    set({ currentFolderId: folderId });
  },

  getFolderPath: async () => {
    const { currentFolderId } = get();
    if (!currentFolderId) return [];
    return dbGetFolderPath(currentFolderId);
  },
}));
