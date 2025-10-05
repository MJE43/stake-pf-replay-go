import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, KeyboardEvent } from 'react';
import type { TableComponents, TableVirtuosoHandle } from 'react-virtuoso';
import { TableVirtuoso } from 'react-virtuoso';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import MultiplierDeltaSummary, { MultiplierOption, TrackedHit } from '@/components/MultiplierDeltaSummary';
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

type RowDeltaInfo = {
  key: string;
  multiplier: number;
  delta: number | null;
};

const difficultyTone: Record<LiveBet['difficulty'], string> = {
  easy: 'border-success-600/40 bg-success-600/15 text-success-600',
  medium: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  hard: 'border-warning-600/40 bg-warning-600/10 text-warning-500',
  expert: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const STORAGE_PREFIX = 'live-delta-preferences';
const MULTIPLIER_PRECISION = 2;
const MAX_RECENT_HITS = 10;

function normalizeMultiplier(value: number) {
  return Number(value.toFixed(MULTIPLIER_PRECISION));
}

function multiplierKey(value: number) {
  return normalizeMultiplier(value).toFixed(MULTIPLIER_PRECISION);
}

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

  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [trackedMultipliers, setTrackedMultipliers] = useState<number[]>([]);
  const [activeMultiplierKey, setActiveMultiplierKey] = useState<string | null>(null);
  const [trackingHydrated, setTrackingHydrated] = useState(false);
  const [newTrackedInput, setNewTrackedInput] = useState('');

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      setTrackingHydrated(true);
      return;
    }

    setTrackingHydrated(false);

    const storageKey = `${STORAGE_PREFIX}:${streamId}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setTrackingEnabled(false);
        setTrackedMultipliers([]);
        setActiveMultiplierKey(null);
        setTrackingHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        enabled?: boolean;
        multipliers?: number[];
        activeKey?: string | null;
      } | null;
      const multipliers = Array.isArray(parsed?.multipliers)
        ? parsed!.multipliers
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => normalizeMultiplier(value))
        : [];
      setTrackingEnabled(Boolean(parsed?.enabled));
      setTrackedMultipliers(multipliers);
      setActiveMultiplierKey(parsed?.activeKey && typeof parsed.activeKey === 'string' ? parsed.activeKey : null);
    } catch (err) {
      console.warn('Failed to load multiplier tracking preferences', err);
      setTrackingEnabled(false);
      setTrackedMultipliers([]);
      setActiveMultiplierKey(null);
    } finally {
      setTrackingHydrated(true);
    }
  }, [streamId]);

  useEffect(() => {
    if (!trackingHydrated || typeof window === 'undefined') return;
    const storageKey = `${STORAGE_PREFIX}:${streamId}`;
    const payload = {
      enabled: trackingEnabled,
      multipliers: trackedMultipliers,
      activeKey: activeMultiplierKey,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to persist multiplier tracking preferences', err);
    }
  }, [trackingHydrated, streamId, trackingEnabled, trackedMultipliers, activeMultiplierKey]);

  useEffect(() => {
    if (!trackedMultipliers.length) {
      setActiveMultiplierKey(null);
      return;
    }
    if (!activeMultiplierKey || !trackedMultipliers.some((value) => multiplierKey(value) === activeMultiplierKey)) {
      setActiveMultiplierKey(multiplierKey(trackedMultipliers[0]));
    }
  }, [trackedMultipliers, activeMultiplierKey]);

  const handleAddTrackedMultiplier = useCallback(() => {
    const trimmed = newTrackedInput.trim();
    if (!trimmed) return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    const normalized = normalizeMultiplier(parsed);
    const key = multiplierKey(normalized);
    if (trackedMultipliers.some((value) => multiplierKey(value) === key)) {
      setNewTrackedInput('');
      setActiveMultiplierKey((current) => current ?? key);
      return;
    }
    setTrackedMultipliers((prev) => {
      const next = [...prev, normalized].sort((a, b) => a - b);
      return next;
    });
    setNewTrackedInput('');
    setActiveMultiplierKey((current) => current ?? key);
  }, [newTrackedInput, trackedMultipliers]);

  const handleRemoveTrackedMultiplier = useCallback((key: string) => {
    setTrackedMultipliers((prev) => prev.filter((value) => multiplierKey(value) !== key));
    setActiveMultiplierKey((current) => (current === key ? null : current));
  }, []);

  const handleSelectMultiplier = useCallback((key: string) => {
    setActiveMultiplierKey(key);
  }, []);

const handleTrackedInputKeyDown = useCallback(
  (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddTrackedMultiplier();
      }
    },
    [handleAddTrackedMultiplier],
  );

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

  const trackingData = useMemo(() => {
    if (!trackingEnabled || !trackedMultipliers.length || !rows.length) {
      return {
        rowDeltaMap: new Map<number, RowDeltaInfo>(),
        hitsByKey: new Map<string, TrackedHit[]>(),
        hitCounts: new Map<string, number>(),
        trackedKeys: new Set<string>(),
      };
    }

    const trackedKeys = new Set(trackedMultipliers.map((value) => multiplierKey(value)));
    const sortedAsc = [...rows].sort((a, b) => a.nonce - b.nonce);
    const lastNonceByKey = new Map<string, number>();
    const rowMap = new Map<number, RowDeltaInfo>();
    const fullHits = new Map<string, TrackedHit[]>();
    const hitCounts = new Map<string, number>();

    for (const row of sortedAsc) {
      const normalized = normalizeMultiplier(row.round_result);
      const key = multiplierKey(normalized);
      if (!trackedKeys.has(key)) {
        continue;
      }
      const previousNonce = lastNonceByKey.get(key);
      const delta = previousNonce != null ? row.nonce - previousNonce - 1 : null;
      lastNonceByKey.set(key, row.nonce);

      const hit: TrackedHit = {
        rowId: row.id,
        nonce: row.nonce,
        multiplier: normalized,
        delta,
        at: row.date_time,
      };

      const list = fullHits.get(key) ?? [];
      list.push(hit);
      fullHits.set(key, list);
      hitCounts.set(key, (hitCounts.get(key) ?? 0) + 1);
      rowMap.set(row.id, { key, multiplier: normalized, delta });
    }

    const limitedHits = new Map<string, TrackedHit[]>();
    fullHits.forEach((list, key) => {
      const limited = list.slice(-MAX_RECENT_HITS).reverse();
      limitedHits.set(key, limited);
    });

    return {
      rowDeltaMap: rowMap,
      hitsByKey: limitedHits,
      hitCounts,
      trackedKeys,
    };
  }, [trackingEnabled, trackedMultipliers, rows]);

  const handleJumpToHit = useCallback(
    (hit: TrackedHit) => {
      const index = rows.findIndex((row) => row.id === hit.rowId);
      if (index >= 0) {
        virtuosoRef.current?.scrollToIndex({ index, behavior: 'smooth', align: 'center' });
      }
    },
    [rows],
  );

  const showTrackingSummary = trackingEnabled && trackedMultipliers.length > 0;
  const showDeltaColumn = showTrackingSummary;

  const multiplierOptions: MultiplierOption[] = trackedMultipliers.map((value) => {
    const key = multiplierKey(value);
    return {
      key,
      value,
      hitCount: trackingData.hitCounts.get(key) ?? 0,
    };
  });

  const activeHits = activeMultiplierKey ? trackingData.hitsByKey.get(activeMultiplierKey) ?? [] : [];
  const totalHitCount = activeMultiplierKey ? trackingData.hitCounts.get(activeMultiplierKey) ?? 0 : 0;

  const candidateValue = Number(newTrackedInput.trim());
  const canAddMultiplier = trackingEnabled && Number.isFinite(candidateValue) && candidateValue > 0;

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
        {showDeltaColumn && (
          <th className="w-[140px] px-4 py-3 text-right font-semibold text-foreground/75">Δ Nonce</th>
        )}
      </tr>
    ),
    [showDeltaColumn],
  );

  const filterControl = (
    <div className="flex flex-col gap-3 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="track-multipliers-toggle"
            checked={trackingEnabled}
            onCheckedChange={(checked) => setTrackingEnabled(Boolean(checked))}
            disabled={!trackingHydrated}
          />
          <Label htmlFor="track-multipliers-toggle" className="text-xs font-medium text-muted-foreground">
            Track specific multipliers
          </Label>
        </div>

        {trackingEnabled && (
          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <Input
                value={newTrackedInput}
                onChange={(event) => setNewTrackedInput(event.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={handleTrackedInputKeyDown}
                placeholder="Add multiplier (e.g. 12.5)"
                className="h-8 w-full max-w-[180px] rounded-md border border-border bg-background/80 text-xs"
                inputMode="decimal"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddTrackedMultiplier}
                disabled={!canAddMultiplier}
                className="text-xs"
              >
                Add
              </Button>
            </div>

            {trackedMultipliers.length > 0 ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {multiplierOptions.map((option) => {
                  const isActive = option.key === activeMultiplierKey;
                  const label = `${option.value.toFixed(2)}×`;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleSelectMultiplier(option.key)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/40',
                        isActive && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]',
                      )}
                    >
                      <span>{label}</span>
                      <span
                        role="button"
                        aria-label={`Stop tracking ${label}`}
                        className="cursor-pointer text-muted-foreground/70"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveTrackedMultiplier(option.key);
                        }}
                      >
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70">Add multiplier values to monitor their nonce gaps.</span>
            )}
          </div>
        )}
      </div>

      {trackingEnabled && appliedMin > 0 && (
        <span className="text-xs text-warning-500">
          Deltas include only bets above the current minimum multiplier filter ({appliedMin.toFixed(2)}×).
        </span>
      )}
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
        <div className="px-4 pb-3">{filterControl}</div>
        {showTrackingSummary && (
          <div className="px-4 pb-4">
            <MultiplierDeltaSummary
              multipliers={multiplierOptions}
              activeKey={activeMultiplierKey}
              onSelectMultiplier={handleSelectMultiplier}
              hits={activeHits}
              totalHitCount={totalHitCount}
              onJumpToHit={handleJumpToHit}
            />
          </div>
        )}
        <div className="mb-8 flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card text-muted-foreground">
          <span className="text-sm text-foreground/70">No bets yet. Stay tuned!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="px-4 pb-3">{filterControl}</div>

      {showTrackingSummary && (
        <div className="px-4 pb-4">
          <MultiplierDeltaSummary
            multipliers={multiplierOptions}
            activeKey={activeMultiplierKey}
            onSelectMultiplier={handleSelectMultiplier}
            hits={activeHits}
            totalHitCount={totalHitCount}
            onJumpToHit={handleJumpToHit}
          />
        </div>
      )}

      {pendingCount > 0 && !isPinnedToTop && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 z-30 flex justify-center',
            showTrackingSummary ? 'top-40' : 'top-16',
          )}
        >
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
            const deltaInfo = showDeltaColumn ? trackingData.rowDeltaMap.get(bet.id) : undefined;
            const isTrackedHit = Boolean(deltaInfo);
            const deltaDisplay = deltaInfo
              ? typeof deltaInfo.delta === 'number'
                ? deltaInfo.delta.toLocaleString()
                : '—'
              : '—';

            return (
              <>
                <td
                  data-index={index}
                  className={cn(
                    'px-4 py-3 font-mono text-xs text-muted-foreground tabular-nums tracking-tight md:text-sm',
                    isTrackedHit && 'bg-[hsl(var(--primary))]/10',
                  )}
                >
                  {bet.nonce}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-xs font-medium text-foreground/85 tracking-tight md:text-sm',
                    isTrackedHit && 'bg-[hsl(var(--primary))]/10',
                  )}
                >
                  {formatDate(bet.date_time)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono text-xs font-semibold text-foreground tabular-nums tracking-tight md:text-sm',
                    isTrackedHit && 'bg-[hsl(var(--primary))]/10',
                  )}
                >
                  {bet.amount.toFixed(2)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono text-xs font-semibold text-foreground tabular-nums tracking-tight md:text-sm',
                    isTrackedHit && 'bg-[hsl(var(--primary))]/10',
                  )}
                >
                  {bet.payout.toFixed(2)}
                </td>
                <td
                  className={cn('px-4 py-3', isTrackedHit && 'bg-[hsl(var(--primary))]/10')}
                >
                  <Badge className={cn('capitalize border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide', toneClass)}>
                    {bet.difficulty}
                  </Badge>
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums tracking-tight md:text-sm',
                    isTrackedHit && 'bg-[hsl(var(--primary))]/10',
                  )}
                >
                  {bet.round_target ?? '--'}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono text-xs font-semibold text-[hsl(var(--primary))] tabular-nums tracking-tight md:text-sm',
                    isTrackedHit && 'bg-[hsl(var(--primary))]/10',
                  )}
                >
                  {bet.round_result.toFixed(2)}
                </td>
                {showDeltaColumn && (
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums tracking-tight text-muted-foreground md:text-sm',
                      isTrackedHit && 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
                    )}
                    title={deltaInfo ? `Gap between ${deltaInfo.multiplier.toFixed(2)}× hits` : undefined}
                  >
                    {deltaInfo ? deltaDisplay : '—'}
                  </td>
                )}
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
