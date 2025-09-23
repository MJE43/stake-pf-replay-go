import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TableComponents, TableVirtuosoHandle } from 'react-virtuoso';
import { TableVirtuoso } from 'react-virtuoso';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBetsStream } from '@/hooks/useBetsStream';
import type { LiveBet } from '@/types/live';

const tableComponents: TableComponents<LiveBet> = {
  Table: ({ style, ...props }) => (
    <table
      {...props}
      style={style}
      className="w-full border-separate border-spacing-0 text-left text-xs md:text-sm"
    />
  ),
  TableHead: ({ style, ...props }) => (
    <thead
      {...props}
      style={style}
      className="bg-muted/60 text-[0.65rem] uppercase tracking-wide text-slate-500"
    />
  ),
  TableRow: ({ style, ...props }) => (
    <tr
      {...props}
      style={style}
      className="border-b border-slate-100 transition-colors hover:bg-slate-50 focus-visible:bg-slate-100"
    />
  ),
  TableBody: ({ style, ...props }) => (
    <tbody {...props} style={style} className="bg-white" />
  ),
};

type LiveBetsTableProps = {
  streamId: string;
  minMultiplier?: number;
  apiBase?: string;
};

const difficultyVariant: Record<LiveBet['difficulty'], 'default' | 'secondary' | 'destructive'> = {
  easy: 'secondary',
  medium: 'default',
  hard: 'default',
  expert: 'destructive',
};

function formatDate(value?: string) {
  if (!value) return '--';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const LiveBetsTableComponent = ({ streamId, minMultiplier, apiBase }: LiveBetsTableProps) => {
  const virtuosoRef = useRef<TableVirtuosoHandle>(null);
  const [isPinnedToTop, setIsPinnedToTop] = useState(true);

  const {
    rows,
    pendingCount,
    flushPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isInitialLoading,
    isError,
    error,
    isStreaming,
    refetch,
  } = useBetsStream({ streamId, minMultiplier, apiBase, pageSize: 250, pollMs: 1500, order: 'desc' });

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleRangeChange = useCallback(
    ({ startIndex }: { startIndex: number }) => {
      setIsPinnedToTop(startIndex <= 1);
    },
    [],
  );

  useEffect(() => {
    if (!pendingCount || !isPinnedToTop) return;
    const added = flushPending();
    if (added.length) {
      virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
    }
  }, [flushPending, isPinnedToTop, pendingCount]);

  const revealBufferedRows = useCallback(() => {
    const added = flushPending();
    if (added.length) {
      virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth', align: 'start' });
    }
  }, [flushPending]);

  const fixedHeader = useMemo(
    () => (
      <tr className="sticky top-0 z-20 bg-white text-[0.65rem] uppercase tracking-wide text-slate-500">
        <th className="w-[90px] px-3 py-2 font-medium text-slate-500">Nonce</th>
        <th className="w-[160px] px-3 py-2 font-medium text-slate-500">Date</th>
        <th className="w-[120px] px-3 py-2 font-medium text-slate-500">Amount</th>
        <th className="w-[120px] px-3 py-2 font-medium text-slate-500">Payout</th>
        <th className="w-[120px] px-3 py-2 font-medium text-slate-500">Difficulty</th>
        <th className="w-[120px] px-3 py-2 font-medium text-slate-500">Target</th>
        <th className="w-[120px] px-3 py-2 font-medium text-slate-500">Result</th>
      </tr>
    ),
    [],
  );

  if (isInitialLoading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-slate-200 bg-white">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 text-red-600">
        <span>Failed to load bets.</span>
        <span className="text-xs text-red-500">{(error as Error)?.message ?? 'Unknown error'}</span>
        <Button onClick={() => refetch()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-slate-500">
        <span>No bets yet. Stay tuned!</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {pendingCount > 0 && !isPinnedToTop && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
          <Button onClick={revealBufferedRows} className="pointer-events-auto shadow" size="sm">
            Show {pendingCount} new bet{pendingCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <TableVirtuoso
        ref={virtuosoRef}
        data={rows}
        totalCount={rows.length}
        components={tableComponents}
        fixedHeaderContent={() => fixedHeader}
        endReached={handleEndReached}
        rangeChanged={handleRangeChange}
        overscan={200}
        initialTopMostItemIndex={0}
        itemContent={(index, bet) => {
          const variant = difficultyVariant[bet.difficulty as keyof typeof difficultyVariant] ?? 'default';
          return (
            <tr key={bet.id} data-index={index}>
              <td className="px-3 py-2 font-mono text-xs text-slate-600">{bet.nonce}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-700">{formatDate(bet.date_time)}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-800">{bet.amount.toFixed(2)}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-800">{bet.payout.toFixed(2)}</td>
              <td className="px-3 py-2">
                <Badge variant={variant} className="capitalize">
                  {bet.difficulty}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-slate-600">{bet.round_target ?? '--'}</td>
              <td className="px-3 py-2 font-mono text-xs text-indigo-600">{bet.round_result.toFixed(2)}</td>
            </tr>
          );
        }}
      />

      {!isStreaming && (
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1 text-xs text-amber-600 shadow">
          Reconnecting to live feed...
        </div>
      )}

      {isFetchingNextPage && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow">
          Loading older bets...
        </div>
      )}
    </div>
  );
};

export default memo(LiveBetsTableComponent);
