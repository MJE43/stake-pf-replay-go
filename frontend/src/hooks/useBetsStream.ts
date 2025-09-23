import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventsOn } from '@wails/runtime/runtime';
import { GetBets } from '@wails/go/livehttp/LiveModule';
import type { LiveBet, LiveBetPage } from '@/types/live';
import { mergeRows, normalizeLiveBet, unpackGetBets, type RawLiveBet } from '@/lib/live-normalizers';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';

export interface UseBetsStreamOptions {
  streamId: string;
  minMultiplier?: number;
  pageSize?: number;
  pollMs?: number;
  order?: 'asc' | 'desc';
  apiBase?: string;
}

type InfinitePages = {
  pages: { rows: LiveBet[]; total: number | null }[];
  pageParams: unknown[];
};

async function fetchHttpPage(options: {
  apiBase: string;
  streamId: string;
  minMultiplier: number;
  order: 'asc' | 'desc';
  pageSize: number;
  offset: number;
}): Promise<{ rows: RawLiveBet[]; total: number | null }> {
  const { apiBase, streamId, minMultiplier, order, pageSize, offset } = options;
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
    order: order === 'desc' ? 'nonce_desc' : 'nonce_asc',
  });
  if (minMultiplier > 0) {
    params.set('min_multiplier', String(minMultiplier));
  }
  const response = await fetch(`${apiBase}/live/streams/${streamId}/bets?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { rows?: RawLiveBet[]; total?: number | null };
  return {
    rows: payload.rows ?? [],
    total: payload.total ?? null,
  };
}

export function useBetsStream({
  streamId,
  minMultiplier = 0,
  pageSize = 200,
  pollMs = 1500,
  order = 'desc',
  apiBase,
}: UseBetsStreamOptions) {
  const queryClient = useQueryClient();
  const pendingRef = useRef<LiveBet[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [bufferVersion, setBufferVersion] = useState(0);
  const betsBindingRef = useRef<Promise<void> | null>(null);

  const queryKey = useMemo(
    () => ['live-bets', streamId, { minMultiplier, pageSize, order, source: apiBase ?? 'wails' }] as const,
    [streamId, minMultiplier, pageSize, order, apiBase],
  );

  const query = useInfiniteQuery<LiveBetPage>({
    queryKey,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.rows.length < pageSize) {
        return undefined;
      }
      return pages.length * pageSize;
    },
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam ?? 0);
      if (apiBase) {
        try {
          const httpResult = await fetchHttpPage({
            apiBase,
            streamId,
            minMultiplier,
            order,
            pageSize,
            offset,
          });
          return {
            rows: httpResult.rows.map(normalizeLiveBet),
            total: httpResult.total,
          };
        } catch (err) {
          console.warn('HTTP live bets request failed, falling back to Wails bridge.', err);
        }
      }
      if (!betsBindingRef.current) {
        betsBindingRef.current = waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'GetBets'], {
          timeoutMs: 10_000,
        });
      }
      await betsBindingRef.current;
      const wailsResult = await callWithRetry(
        () => GetBets(streamId, minMultiplier, order, pageSize, offset),
        4,
        250,
      );
      return unpackGetBets(wailsResult);
    },
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
  });

  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return [] as LiveBet[];
    const pending = pendingRef.current;
    pendingRef.current = [];
    queryClient.setQueryData(queryKey, (current?: InfinitePages) => {
      if (!current) return current;
      const [first, ...rest] = current.pages;
      const nextFirst = {
        total: first?.total ?? null,
        rows: mergeRows(first?.rows ?? [], pending, order),
      };
      return {
        ...current,
        pages: [nextFirst, ...rest],
      };
    });
    setBufferVersion((version) => version + 1);
    return pending;
  }, [order, queryClient, queryKey]);

  useEffect(() => {
    pendingRef.current = [];
    setBufferVersion((version) => version + 1);
  }, [streamId]);

  useEffect(() => {
    const offRows = EventsOn(`live:newrows:${streamId}`, (...payload: RawLiveBet[]) => {
      if (!payload || payload.length === 0) return;
      const flatPayload = payload.length === 1 && Array.isArray(payload[0]) ? (payload[0] as RawLiveBet[]) : payload;
      if (!flatPayload.length) return;
      const normalized = flatPayload.map(normalizeLiveBet);
      const existingIds = new Set(pendingRef.current.map((bet) => bet.id));
      const deduped = normalized.filter((bet) => !existingIds.has(bet.id));
      if (!deduped.length) return;
      pendingRef.current = mergeRows(pendingRef.current, deduped, order);
      setBufferVersion((version) => version + 1);
      setIsStreaming(true);
    });

    const offStatus = EventsOn(`live:status:${streamId}`, (status: 'connected' | 'disconnected') => {
      setIsStreaming(status === 'connected');
    });

    return () => {
      offRows();
      offStatus();
    };
  }, [order, streamId]);

  const prepend = useCallback(
    (rows: LiveBet[]) => {
      if (!rows.length) return;
      queryClient.setQueryData(queryKey, (current?: InfinitePages) => {
        if (!current) return current;
        const [first, ...rest] = current.pages;
        const nextFirst = {
          total: first?.total ?? null,
          rows: mergeRows(first?.rows ?? [], rows, order),
        };
        return {
          ...current,
          pages: [nextFirst, ...rest],
        };
      });
    },
    [order, queryClient, queryKey],
  );

  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];

  return {
    rows,
    flushPending,
    pendingCount: pendingRef.current.length,
    bufferVersion,
    prepend,
    isStreaming,
    ...query,
  };
}
