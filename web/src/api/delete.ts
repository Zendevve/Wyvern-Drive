import { apiFetch } from '../lib/api';

export interface DeleteResult {
  success: boolean;
  deleted_nodes: number;
  deleted_messages: string[];
}

export function deleteNode(id: string): Promise<DeleteResult> {
  return apiFetch<DeleteResult>('/fs/node', {
    method: 'DELETE',
    body: JSON.stringify({ id })
  });
}
