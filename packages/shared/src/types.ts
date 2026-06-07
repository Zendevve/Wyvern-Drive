// Core types for @disbox/shared. Pure data shapes — no runtime behavior here.

export interface Chunk {
  index: number;
  hash: string;
  bytes: Uint8Array;
  size: number;
}

export interface ChunkRef {
  hash: string;
  size: number;
  discordMessageId?: string;
  discordChannelId?: string;
}

export interface FileManifest {
  id: string;
  path: string;
  size: number;
  mime: string;
  chunks: ChunkRef[];
  createdAt: number;
  updatedAt: number;
  encrypted?: boolean;
}

export type TreeNodeType = 'file' | 'directory';

export interface TreeNode {
  name: string;
  type: TreeNodeType;
  hash: string;
  size: number;
  children?: TreeNode[];
}
