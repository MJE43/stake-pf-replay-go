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
      className={cn('w-full border-separate border-spacing-0 text-left text-sm leading-6 text-foreground/85', className)}
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
      className={cn('bg-muted/80 text-[0.65rem] md:text-xs uppercase tracking-[0.18em] text-muted-foreground', className)}
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
      className={cn('group border-b border-border/60 bg-card/70 transition-colors hover:bg-muted/70 focus-visible:bg-muted/60', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tbody'>>(
  ({ style, className, ...props }, ref) => (
    <tbody ref={ref} style={style} className={cn('bg-card', className)} {...props} />
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
  easy: 'border-success-600/40 bg-success-600/15 text-success-600',
  medium: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  hard: 'border-warning-600/40 bg-warning-600/10 text-warning-500',
  expert: 'border-destructive/40 bg-destructive/10 text-destructive',
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
      <tr className="sticky top-0 z-20 bg-card/95 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
        <th className="w-[90px] px-4 py-3 text-left font-semibold text-foreground/75">Nonce</th>
        <th className="w-[160px] px-4 py-3 text-left font-semibold text-foreground/75">Date</th>
        <th className="w-[120px] px-4 py-3 text-right font-semibold text-foreground/75">Amount</th>
        <th className="w-[120px] px-4 py-3 text-right font-semibold text-foreground/75">Payout</th>
        <th className="w-[120px] px-4 py-3 text-left font-semibold text-foreground/75">Difficulty</th>
        <th className="w-[120px] px-4 py-3 text-right font-semibold text-foreground/75">Target</th>
        <th className="w-[120px] px-4 py-3 text-right font-semibold text-foreground/75">Result</th>
      </tr>
    ),
    [],
  );

  const filterControl = (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full shadow-sm',
            isStreaming
              ? 'bg-success-600 shadow-[0_0_12px_rgba(70,167,88,0.45)]'
              : 'bg-warning-600 animate-pulse shadow-[0_0_12px_rgba(255,178,36,0.5)]',
          )}
        />
        <span className="font-medium tracking-wide text-foreground/80">{isStreaming ? 'Live' : 'Reconnecting…'}</span>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground/70">
          {rows.length.toLocaleString()} loaded{totalKnown != null ? ` / ${totalKnown.toLocaleString()}` : ''}
        </span>
        {pendingCount > 0 && isPinnedToTop && (
          <span className="rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 px-2 py-0.5 text-[hsl(var(--primary))]">
            {pendingCount} buffered
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="min-multiplier" className="text-xs uppercase tracking-wider text-muted-foreground">
          Min ×
        </Label>
        <Input
          id="min-multiplier"
          value={minFilterRaw}
          inputMode="decimal"
          onChange={(event) => setMinFilterRaw(event.target.value.replace(/[^0-9.]/g, ''))}
          className="h-8 w-24 rounded-md border border-border bg-background/80 text-right font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-[hsl(var(--primary))] focus-visible:ring-0"
          placeholder="0"
        />
      </div>
    </div>
  );

  if (isInitialLoading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card">
        <Skeleton className="h-12 w-12 rounded-full bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-4 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
        <span>Failed to load bets.</span>
        <span className="text-xs text-destructive/70">{(error as Error)?.message ?? 'Unknown error'}</span>
        <Button
          onClick={() => refetch()}
          variant="secondary"
          className="border border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive/30"
        >
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
        <div className="mb-8 flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card text-muted-foreground">
          <span className="text-sm text-foreground/70">No bets yet. Stay tuned!</span>
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
            className="pointer-events-auto border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/20 px-3 text-[hsl(var(--primary))] shadow-md hover:bg-[hsl(var(--primary))]/30"
          >
            Show {pendingCount} new bet{pendingCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <div style={{ height: '500px' }} className="mb-8 overflow-hidden rounded-xl border border-border bg-card/90 shadow-md">
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
                <td
                  data-index={index}
                  className="px-4 py-3 font-mono text-xs md:text-sm text-muted-foreground tabular-nums tracking-tight"
                >
                  {bet.nonce}
                </td>
                <td className="px-4 py-3 text-xs md:text-sm font-medium text-foreground/85 tracking-tight">
                  {formatDate(bet.date_time)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs md:text-sm font-semibold text-foreground tabular-nums tracking-tight">
                  {bet.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs md:text-sm font-semibold text-foreground tabular-nums tracking-tight">
                  {bet.payout.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn('capitalize border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide', toneClass)}>
                    {bet.difficulty}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs md:text-sm text-muted-foreground tabular-nums tracking-tight">
                  {bet.round_target ?? '--'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs md:text-sm font-semibold text-[hsl(var(--primary))] tabular-nums tracking-tight">
                  {bet.round_result.toFixed(2)}
                </td>
              </>
            );
          }}
        />
      </div>

      {!isStreaming && (
        <div className="absolute bottom-12 left-1/2 z-30 -translate-x-1/2 rounded-full border border-warning-600/40 bg-warning-600/15 px-4 py-1 text-xs text-warning-500 shadow-md">
          Reconnecting to live feed...
        </div>
      )}

      {isFetchingNextPage && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-md">
          Loading older bets...
        </div>
      )}
    </div>
  );
};

export default memo(LiveBetsTableComponent);
