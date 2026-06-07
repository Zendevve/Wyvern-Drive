# @disbox/shared

Browser-and-Node-safe protocol SDK for Disbox v2. Filled in during **Phase 1**.

Planned surface:

```ts
// chunker.ts
export interface Chunk {
  index: number;
  hash: string;
  bytes: Uint8Array;
}
export function chunkFile(input: ArrayBuffer | Uint8Array, opts: { chunkSize: number }): Chunk[];

// hasher.ts
export function hashChunk(bytes: Uint8Array): string; // hex SHA-256

// tree-codec.ts
export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  hash: string;
  children?: TreeNode[];
}
export function encodeTree(root: TreeNode): Uint8Array;
export function decodeTree(bytes: Uint8Array): TreeNode;

// types.ts
export interface FileManifest {
  id: string;
  path: string;
  size: number;
  chunks: ChunkRef[];
  mime: string;
  createdAt: number;
  updatedAt: number;
}
export interface ChunkRef {
  hash: string;
  size: number;
  discordMessageId?: string;
  discordChannelId?: string;
}
```

**Zero React, Discord, or Node-specific APIs in core.** Pure data manipulation.
