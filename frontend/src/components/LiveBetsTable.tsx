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
      className={cn('w-full border-separate border-spacing-0 text-left text-xs md:text-sm text-slate-200', className)}
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
      className={cn('bg-slate-950/95 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70', className)}
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
      className={cn('border-b border-slate-800/70 transition-colors bg-slate-950/70 hover:bg-slate-900 focus-visible:bg-slate-900', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tbody'>>(
  ({ style, className, ...props }, ref) => (
    <tbody ref={ref} style={style} className={cn('bg-slate-950', className)} {...props} />
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

const difficultyTone: Record<LiveBet['difficulty'], string> = {
  easy: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  medium: 'border-slate-600 bg-slate-800/80 text-slate-200',
  hard: 'border-slate-500 bg-slate-700/80 text-slate-100',
  expert: 'border-rose-500/60 bg-rose-500/10 text-rose-200',
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
      <tr className="sticky top-0 z-20 bg-slate-950/98 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70 backdrop-blur-sm">
        <th className="w-[90px] px-4 py-3 text-left font-semibold text-slate-300">Nonce</th>
        <th className="w-[160px] px-4 py-3 text-left font-semibold text-slate-300">Date</th>
        <th className="w-[120px] px-4 py-3 text-left font-semibold text-slate-300">Amount</th>
        <th className="w-[120px] px-4 py-3 text-left font-semibold text-slate-300">Payout</th>
        <th className="w-[120px] px-4 py-3 text-left font-semibold text-slate-300">Difficulty</th>
        <th className="w-[120px] px-4 py-3 text-left font-semibold text-slate-300">Target</th>
        <th className="w-[120px] px-4 py-3 text-left font-semibold text-slate-300">Result</th>
      </tr>
    ),
    [],
  );

  const filterControl = (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
        <span
          className={cn('h-2.5 w-2.5 rounded-full shadow-sm shadow-emerald-500/40', isStreaming ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse')}
        />
        <span className="font-medium tracking-wide text-slate-300">{isStreaming ? 'Live' : 'Reconnecting…'}</span>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 font-medium text-slate-300">
          {rows.length.toLocaleString()} loaded{totalKnown != null ? ` / ${totalKnown.toLocaleString()}` : ''}
        </span>
        {pendingCount > 0 && isPinnedToTop && (
          <span className="rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-[hsl(var(--primary))]">
            {pendingCount} buffered
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="min-multiplier" className="text-xs uppercase tracking-wider text-muted-foreground/70">
          Min ×
        </Label>
        <Input
          id="min-multiplier"
          value={minFilterRaw}
          inputMode="decimal"
          onChange={(event) => setMinFilterRaw(event.target.value.replace(/[^0-9.]/g, ''))}
          className="h-8 w-24 rounded-md border border-slate-800 bg-slate-900 text-right font-mono text-xs text-slate-100 placeholder:text-muted-foreground focus-visible:border-[hsl(var(--primary))] focus-visible:ring-0"
          placeholder="0"
        />
      </div>
    </div>
  );

  if (isInitialLoading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-slate-900 bg-slate-950">
        <Skeleton className="h-12 w-12 rounded-full bg-slate-800" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-4 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200">
        <span>Failed to load bets.</span>
        <span className="text-xs text-rose-300/80">{(error as Error)?.message ?? 'Unknown error'}</span>
        <Button onClick={() => refetch()} variant="secondary" className="border border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30">
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
        <div className="mb-8 flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-slate-900 bg-slate-950 text-muted-foreground/70">
          <span className="text-sm text-slate-300">No bets yet. Stay tuned!</span>
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
          <Button
            onClick={revealBufferedRows}
            size="sm"
            className="pointer-events-auto border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/20 px-3 text-[hsl(var(--primary))] shadow-lg hover:bg-[hsl(var(--primary))]/30"
          >
            Show {pendingCount} new bet{pendingCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <div style={{ height: '500px' }} className="mb-8 overflow-hidden rounded-xl border border-slate-900 bg-slate-950/90">
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
            const toneClass = difficultyTone[bet.difficulty as keyof typeof difficultyTone] ?? difficultyTone.medium;
            return (
              <>
                <td data-index={index} className="px-4 py-3 font-mono text-[0.7rem] text-muted-foreground/70">{bet.nonce}</td>
                <td className="px-4 py-3 font-mono text-[0.7rem] text-slate-300">{formatDate(bet.date_time)}</td>
                <td className="px-4 py-3 font-mono text-[0.7rem] text-slate-200">{bet.amount.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-[0.7rem] text-slate-200">{bet.payout.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <Badge className={cn('capitalize border px-2 py-0.5 text-[0.65rem] font-medium', toneClass)}>
                    {bet.difficulty}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-[0.7rem] text-slate-300">{bet.round_target ?? '--'}</td>
                <td className="px-4 py-3 font-mono text-[0.7rem] text-[hsl(var(--primary))]">{bet.round_result.toFixed(2)}</td>
              </>
            );
          }}
        />
      </div>

      {!isStreaming && (
        <div className="absolute bottom-12 left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-400/50 bg-amber-500/100/10 px-4 py-1 text-xs text-amber-200 shadow-lg">
          Reconnecting to live feed...
        </div>
      )}

      {isFetchingNextPage && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 shadow-lg">
          Loading older bets...
        </div>
      )}
    </div>
  );
};

export default memo(LiveBetsTableComponent);
