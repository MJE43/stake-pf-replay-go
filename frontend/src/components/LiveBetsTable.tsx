import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import type { TableComponents, TableVirtuosoHandle } from 'react-virtuoso';
import { TableVirtuoso } from 'react-virtuoso';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBetsStream } from '@/hooks/useBetsStream';
import { cn } from '@/lib/utils';
import type { LiveBet } from '@/types/live';

const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<'table'>>(
  ({ style, className, ...props }, ref) => (
    <table
      ref={ref}
      style={style}
      className={cn('w-full border-separate border-spacing-0 text-left text-xs md:text-sm', className)}
      {...props}
    />
  ),
);
Table.displayName = 'Table';

const TableHead = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'thead'>>(
  ({ style, className, ...props }, ref) => (
    <thead
      ref={ref}
      style={style}
      className={cn('bg-muted/60 text-[0.65rem] uppercase tracking-wide text-slate-500', className)}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

const TableRow = forwardRef<HTMLTableRowElement, ComponentPropsWithoutRef<'tr'>>(
  ({ style, className, ...props }, ref) => (
    <tr
      ref={ref}
      style={style}
      className={cn('border-b border-slate-100 transition-colors hover:bg-slate-50 focus-visible:bg-slate-100', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tbody'>>(
  ({ style, className, ...props }, ref) => (
    <tbody ref={ref} style={style} className={cn('bg-white', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

const tableComponents: TableComponents<LiveBet> = {
  Table,
  TableHead,
  TableRow,
  TableBody,
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
  const [minFilterRaw, setMinFilterRaw] = useState(minMultiplier ? String(minMultiplier) : '');
  const [appliedMin, setAppliedMin] = useState(minMultiplier ?? 0);

  useEffect(() => {
    setMinFilterRaw(minMultiplier ? String(minMultiplier) : '');
    setAppliedMin(minMultiplier ?? 0);
  }, [minMultiplier]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (minFilterRaw === '') {
        setAppliedMin(0);
        return;
      }
      const parsed = Number(minFilterRaw);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setAppliedMin(parsed);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [minFilterRaw]);

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
    data,
  } = useBetsStream({ streamId, minMultiplier: appliedMin, apiBase, pageSize: 250, pollMs: 1500, order: 'desc' });

  const totalKnown = data?.pages?.[0]?.total ?? null;

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

  const filterControl = (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span
          className={cn('h-2.5 w-2.5 rounded-full', isStreaming ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')}
        />
        <span>{isStreaming ? 'Live' : 'Reconnecting…'}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
          {rows.length.toLocaleString()} loaded{totalKnown != null ? ` / ${totalKnown.toLocaleString()}` : ''}
        </span>
        {pendingCount > 0 && isPinnedToTop && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600">
            {pendingCount} buffered
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="min-multiplier" className="text-xs text-slate-500">
          Min ×
        </Label>
        <Input
          id="min-multiplier"
          value={minFilterRaw}
          inputMode="decimal"
          onChange={(event) => setMinFilterRaw(event.target.value.replace(/[^0-9.]/g, ''))}
          className="h-8 w-24 text-right font-mono text-xs"
          placeholder="0"
        />
      </div>
    </div>
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
      <div className="relative">
        <div className="px-4 pb-3">
          {filterControl}
        </div>
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500 mb-8">
          <span>No bets yet. Stay tuned!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="px-4 pb-3">
        {filterControl}
      </div>
      
      {pendingCount > 0 && !isPinnedToTop && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center">
          <Button onClick={revealBufferedRows} className="pointer-events-auto shadow" size="sm">
            Show {pendingCount} new bet{pendingCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <div style={{ height: '500px' }} className="mb-8">
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
              <>
                <td data-index={index} className="px-3 py-2 font-mono text-xs text-slate-600">{bet.nonce}</td>
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
              </>
            );
          }}
        />
      </div>

      {!isStreaming && (
        <div className="absolute bottom-12 left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1 text-xs text-amber-600 shadow">
          Reconnecting to live feed...
        </div>
      )}

      {isFetchingNextPage && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow">
          Loading older bets...
        </div>
      )}
    </div>
  );
};

export default memo(LiveBetsTableComponent);
