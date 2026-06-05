import { useQueryClient } from '@tanstack/react-query';
import { useRef, useCallback } from 'react';
import { listChildren } from '../api/fs';

const PREFETCH_DELAY_MS = 200;

export function useFolderPrefetch() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNodeIdRef = useRef<string | null | undefined>(undefined);

  const prefetch = useCallback(
    (nodeId: string | null) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (lastNodeIdRef.current === nodeId) return;
      lastNodeIdRef.current = nodeId;
      timerRef.current = setTimeout(() => {
        void queryClient.prefetchQuery({
          queryKey: ['folder', nodeId],
          queryFn: () => listChildren(nodeId),
          staleTime: 30_000
        });
      }, PREFETCH_DELAY_MS);
    },
    [queryClient]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastNodeIdRef.current = undefined;
  }, []);

  return { prefetch, cancel };
}
