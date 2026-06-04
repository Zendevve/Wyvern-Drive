import { useQuery } from '@tanstack/react-query';
import { getNode, listChildren, type ListResponse, type NodeResponse } from '../api/fs';

export function useFolder(parentId: string | null) {
  return useQuery<ListResponse, Error>({
    queryKey: ['folder', parentId],
    queryFn: () => listChildren(parentId),
    staleTime: 30_000
  });
}

export function useNode(id: string | null | undefined) {
  return useQuery<NodeResponse, Error>({
    queryKey: ['node', id],
    queryFn: () => getNode(id as string),
    enabled: Boolean(id),
    staleTime: 30_000
  });
}
