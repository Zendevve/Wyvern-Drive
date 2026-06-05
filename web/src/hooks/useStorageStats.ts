import { useQuery } from '@tanstack/react-query';
import { getStorageStats, type StorageStats } from '../api/fs';

export function useStorageStats() {
  return useQuery<StorageStats, Error>({
    queryKey: ['storage-stats'],
    queryFn: () => getStorageStats(),
    refetchInterval: 10_000 // refetch every 10 seconds to keep stats fresh
  });
}
