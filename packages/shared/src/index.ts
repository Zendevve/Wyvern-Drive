// @disbox/shared — Disbox v2 protocol SDK.
// Browser-and-Node-safe. No React, Discord, or Node-specific APIs in core.

export { chunkFile, DEFAULT_CHUNK_SIZE } from './chunker.js';
export type { ChunkOptions } from './chunker.js';
export { hashChunk, hashChildren, sha256, sha256Hex } from './hasher.js';
export { encodeTree, decodeTree } from './tree-codec.js';
export { buildManifest, verifyManifest } from './manifest.js';
export type { ManifestInput, VerifyResult } from './manifest.js';

export type { Chunk, ChunkRef, FileManifest, TreeNode, TreeNodeType } from './types.js';

export const SHARED_SDK_VERSION = '0.1.0';
