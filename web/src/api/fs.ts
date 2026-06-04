export interface Node {
  id: string;
  parent_id: string | null;
  account_id: string;
  name: string;
  kind: 'file' | 'folder';
  size_bytes: number | null;
  mime_type: string | null;
  created_at: number;
  updated_at: number;
}

export interface Chunk {
  id: number;
  node_id: string;
  discord_message_id: string;
  index: number;
  size_bytes: number;
  cdn_url: string;
}

export interface ListResponse {
  items: Node[];
}

export interface NodeResponse {
  node: Node;
  chunks: Chunk[];
}

import { apiFetch } from '../lib/api';

export function listChildren(parentId: string | null): Promise<ListResponse> {
  const query = parentId === null ? '' : `?parent_id=${encodeURIComponent(parentId)}`;
  return apiFetch<ListResponse>(`/fs/list${query}`);
}

export function getNode(id: string): Promise<NodeResponse> {
  return apiFetch<NodeResponse>(`/fs/node?id=${encodeURIComponent(id)}`);
}
