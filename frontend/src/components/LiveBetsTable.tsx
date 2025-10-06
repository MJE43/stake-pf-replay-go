import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, KeyboardEvent } from 'react';
import type { TableComponents, TableVirtuosoHandle } from 'react-virtuoso';
import { TableVirtuoso } from 'react-virtuoso';
import { IconColumns, IconX } from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import MultiplierDeltaSummary, { MultiplierOption, TrackedHit } from '@/components/MultiplierDeltaSummary';
import { useBetsStream } from '@/hooks/useBetsStream';
import { useStreamPreferences } from '@/hooks/useStreamPreferences';
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
  const [newTrackedInput, setNewTrackedInput] = useState('');
  const preferenceTimer = useRef<number | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);

  const {
    preferences,
    hydrated,
    setDensity,
    setColumns,
    setTracking,
    addTrackedMultiplier,
    removeTrackedMultiplier,
    setActiveMultiplierKey,
  } = useStreamPreferences(streamId);

  const { density, columns, tracking } = preferences;
  const { enabled: trackingEnabled, multipliers: trackedMultipliers, activeKey: activeMultiplierKey } = tracking;

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

  const announcePreference = useCallback((message: string) => {
    setPreferenceStatus(message);
    if (preferenceTimer.current) {
      window.clearTimeout(preferenceTimer.current);
    }
    preferenceTimer.current = window.setTimeout(() => {
      setPreferenceStatus(null);
      preferenceTimer.current = null;
    }, 2000);
  }, []);

  useEffect(() => () => {
    if (preferenceTimer.current) {
      window.clearTimeout(preferenceTimer.current);
    }
  }, []);

  useEffect(() => {
    if (!trackedMultipliers.length) {
      setActiveMultiplierKey(null);
      return;
    }
    if (!activeMultiplierKey || !trackedMultipliers.some((value) => multiplierKey(value) === activeMultiplierKey)) {
      setActiveMultiplierKey(multiplierKey(trackedMultipliers[0]));
    }
  }, [trackedMultipliers, activeMultiplierKey, setActiveMultiplierKey]);

  const handleAddTrackedMultiplier = useCallback(() => {
    const trimmed = newTrackedInput.trim();
    if (!trimmed) return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    addTrackedMultiplier(parsed);
    setNewTrackedInput('');
    announcePreference(`Tracking ${Number(parsed.toFixed(2)).toFixed(2)}×`);
  }, [newTrackedInput, addTrackedMultiplier, announcePreference]);

  const handleRemoveTrackedMultiplier = useCallback((key: string) => {
    removeTrackedMultiplier(key);
    announcePreference('Stopped tracking multiplier');
  }, [removeTrackedMultiplier, announcePreference]);

  const handleSelectMultiplier = useCallback((key: string) => {
    setActiveMultiplierKey(key);
  }, [setActiveMultiplierKey]);

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
        warnings: [] as string[],
      };
    }

    try {
      const trackedKeys = new Set(trackedMultipliers.map((value) => multiplierKey(value)));

      const seenIds = new Set<number>();
      const dedupedRows = rows.filter((row) => {
        if (seenIds.has(row.id)) return false;
        seenIds.add(row.id);
        return true;
      });
      // Pre-filter to tracked multipliers for efficiency
      const filtered = dedupedRows.filter((r) => trackedKeys.has(multiplierKey(normalizeMultiplier(r.round_result))));

      const sortedAsc = [...filtered].sort((a, b) => {
        if (a.nonce !== b.nonce) return a.nonce - b.nonce;
        return a.id - b.id;
      });

      const lastNonceByKey = new Map<string, number>();
      const rowMap = new Map<number, RowDeltaInfo>();
      const fullHits = new Map<string, TrackedHit[]>();
      const hitCounts = new Map<string, number>();
      const warnings: string[] = [];

      for (const row of sortedAsc) {
        const normalized = normalizeMultiplier(row.round_result);
        const key = multiplierKey(normalized);
        if (!trackedKeys.has(key)) {
          continue;
        }

        const previousNonce = lastNonceByKey.get(key);
        let delta: number | null = null;

        if (previousNonce != null) {
          const rawDelta = row.nonce - previousNonce - 1;
          if (rawDelta < 0) {
            warnings.push(`Negative delta detected for ${key}× at nonce ${row.nonce}`);
            delta = null;
          } else if (rawDelta > 100000) {
            warnings.push(`Suspiciously large delta (${rawDelta}) for ${key}× at nonce ${row.nonce}`);
            delta = rawDelta;
          } else {
            delta = rawDelta;
          }
        }

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

      if (warnings.length > 0) {
        console.warn('Delta tracking warnings:', warnings);
      }

      return {
        rowDeltaMap: rowMap,
        hitsByKey: limitedHits,
        hitCounts,
        trackedKeys,
        warnings,
      };
    } catch (err) {
      console.error('Failed to calculate tracking data', err);
      return {
        rowDeltaMap: new Map<number, RowDeltaInfo>(),
        hitsByKey: new Map<string, TrackedHit[]>(),
        hitCounts: new Map<string, number>(),
        trackedKeys: new Set<string>(),
        warnings: ['Failed to calculate deltas'],
      };
    }
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

  const showTrackingSummary = hydrated && trackingEnabled && trackedMultipliers.length > 0;
  const showDeltaColumn = showTrackingSummary;
  const showDateColumn = columns.date;
  const showDifficultyColumn = columns.difficulty;
  const showTargetColumn = columns.target;

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

  const headerPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const headerTextClass = density === 'compact' ? 'text-[0.6rem]' : 'text-[0.65rem] md:text-xs';
  const cellPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const cellTextClass = density === 'compact' ? 'text-xs' : 'text-sm';
  const monoTextClass = density === 'compact' ? 'text-xs' : 'text-sm';
  const timestampTextClass = density === 'compact' ? 'text-[0.65rem]' : 'text-[0.75rem]';
  const secondaryLineClass = !showDateColumn && density !== 'compact' ? 'block' : 'hidden';
  const tableContainerStyle = { height: 'calc(100vh - 280px)', minHeight: '420px' } as const;

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
      <tr className="sticky top-0 z-20 bg-card/95 uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
        <th className={cn(headerPadding, headerTextClass, 'w-[120px] text-left font-semibold text-foreground/80')}>Nonce</th>
        {showDateColumn && (
          <th className={cn(headerPadding, headerTextClass, 'w-[180px] text-left font-semibold text-foreground/80')}>Timestamp</th>
        )}
        <th className={cn(headerPadding, headerTextClass, 'w-[110px] text-right font-semibold text-foreground/80')}>Result</th>
        {showDeltaColumn && (
          <th className={cn(headerPadding, headerTextClass, 'w-[110px] text-right font-semibold text-foreground/80')}>Δ Nonce</th>
        )}
        <th className={cn(headerPadding, headerTextClass, 'w-[120px] text-right font-semibold text-foreground/80')}>Amount</th>
        <th className={cn(headerPadding, headerTextClass, 'w-[130px] text-right font-semibold text-foreground/80')}>Payout</th>
        {showDifficultyColumn && (
          <th className={cn(headerPadding, headerTextClass, 'w-[140px] text-left font-semibold text-foreground/80')}>Difficulty</th>
        )}
        {showTargetColumn && (
          <th className={cn(headerPadding, headerTextClass, 'w-[140px] text-right font-semibold text-foreground/80')}>Target</th>
        )}
      </tr>
    ),
    [headerPadding, headerTextClass, showDateColumn, showDeltaColumn, showDifficultyColumn, showTargetColumn],
  );

  const resolveDefaultColumns = () => {
    const width = typeof window === 'undefined' ? 1920 : window.innerWidth;
    return {
      date: width >= 1320,
      difficulty: width >= 1440,
      target: width >= 1680,
    } as const;
  };

  const handleSetDensity = useCallback((next: typeof density) => {
    if (next === density) return;
    setDensity(next);
    announcePreference(`Density set to ${next === 'compact' ? 'Compact' : 'Comfortable'}`);
  }, [density, setDensity, announcePreference]);

  const handleSetTrackingEnabled = useCallback((enabled: boolean) => {
    setTracking({ enabled });
    announcePreference(enabled ? 'Tracking enabled' : 'Tracking paused');
  }, [setTracking, announcePreference]);

  const handleToggleColumn = useCallback((key: 'date' | 'difficulty' | 'target', visible: boolean) => {
    setColumns({ [key]: visible } as any);
    const label = key === 'date' ? 'Timestamp' : key.charAt(0).toUpperCase() + key.slice(1);
    announcePreference(`${visible ? 'Shown' : 'Hidden'} ${label}`);
  }, [setColumns, announcePreference]);

  const handleResetColumns = useCallback(() => {
    const defaults = resolveDefaultColumns();
    setColumns({ ...defaults });
    announcePreference('Column defaults restored');
  }, [setColumns, announcePreference]);

  const filterControl = (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1 font-semibold',
              isStreaming
                ? 'border-success-500/40 bg-success-500/10 text-success-500'
                : 'border-warning-500/40 bg-warning-500/15 text-warning-500',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isStreaming ? 'bg-success-500' : 'bg-warning-500 animate-pulse',
              )}
            />
            {isStreaming ? 'Live' : 'Reconnecting…'}
          </span>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 font-medium text-foreground/80">
            {rows.length.toLocaleString()} loaded
            {totalKnown != null ? ` / ${totalKnown.toLocaleString()}` : ''}
          </span>
          {pendingCount > 0 && isPinnedToTop && (
            <span className="rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 px-3 py-1 text-[hsl(var(--primary))]">
              {pendingCount} buffered
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/60 p-1">
            <button
              type="button"
              onClick={() => handleSetDensity('comfortable')}
              disabled={!hydrated}
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium transition',
                density === 'comfortable'
                  ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]'
                  : 'text-muted-foreground hover:text-foreground',
                !hydrated && 'opacity-60',
              )}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => handleSetDensity('compact')}
              disabled={!hydrated}
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium transition',
                density === 'compact'
                  ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]'
                  : 'text-muted-foreground hover:text-foreground',
                !hydrated && 'opacity-60',
              )}
            >
              Compact
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-border/60 bg-background/70 text-xs text-muted-foreground hover:text-foreground"
                disabled={!hydrated}
              >
                <IconColumns size={16} /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground/80">Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={columns.date}
                disabled={!hydrated}
                onCheckedChange={(checked) => handleToggleColumn('date', Boolean(checked))}
              >
                Timestamp
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columns.difficulty}
                disabled={!hydrated}
                onCheckedChange={(checked) => handleToggleColumn('difficulty', Boolean(checked))}
              >
                Difficulty
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columns.target}
                disabled={!hydrated}
                onCheckedChange={(checked) => handleToggleColumn('target', Boolean(checked))}
              >
                Target
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-muted-foreground/80"
                onSelect={(event) => {
                  event.preventDefault();
                  handleResetColumns();
                }}
              >
                Reset to defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="track-multipliers-toggle"
            checked={trackingEnabled}
            onCheckedChange={(checked) => handleSetTrackingEnabled(Boolean(checked))}
            disabled={!hydrated}
          />
          <Label htmlFor="track-multipliers-toggle" className="text-xs font-medium text-muted-foreground">
            Track specific multipliers
          </Label>
        </div>

        {trackingEnabled && (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                value={newTrackedInput}
                onChange={(event) => setNewTrackedInput(event.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={handleTrackedInputKeyDown}
                placeholder="Add multiplier (e.g. 12.5)"
                className="h-8 w-36 rounded-md border border-border bg-background/80 text-xs"
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
                      <span className="flex items-center gap-1 text-muted-foreground/70">
                        <span>{(option.hitCount ?? 0).toLocaleString()}</span>
                        <button
                          type="button"
                          aria-label={`Stop tracking ${label}`}
                          className="rounded-full p-0.5 text-muted-foreground/60 transition hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveTrackedMultiplier(option.key);
                          }}
                        >
                          <IconX size={12} />
                        </button>
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
        <div className="mt-2 text-xs text-warning-500">
          Deltas include only bets above the current minimum multiplier filter ({appliedMin.toFixed(2)}×).
        </div>
      )}
      {preferenceStatus && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[hsl(var(--primary))]">
          {preferenceStatus}
        </div>
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
      <div className="flex flex-col gap-4">
        {filterControl}
        <div className={cn('grid gap-4', showTrackingSummary ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : '')}>
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-border bg-card/70 p-8 text-sm text-muted-foreground">
            <span className="text-foreground/70">No bets yet. Stay tuned!</span>
          </div>
          {showTrackingSummary && (
            <div className="xl:sticky xl:top-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filterControl}
      <div className={cn('grid gap-4', showTrackingSummary ? 'xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]' : '')}>
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70">
          <div className="flex flex-col">
            <div className="relative" style={tableContainerStyle}>
              <TableVirtuoso
                ref={virtuosoRef}
                data={rows}
                components={tableComponents}
                fixedHeaderContent={() => fixedHeader}
                totalCount={rows.length}
                rangeChanged={handleRangeChange}
                endReached={handleEndReached}
                itemContent={(index, bet) => {
                  const toneClass = difficultyTone[bet.difficulty as keyof typeof difficultyTone] ?? difficultyTone.medium;
                  const deltaInfo = trackingData.rowDeltaMap.get(bet.id) ?? null;
                  const deltaDisplay = deltaInfo && typeof deltaInfo.delta === 'number' ? deltaInfo.delta.toLocaleString() : '—';
                  const isTrackedHit = deltaInfo != null && deltaInfo.delta != null;
                  const highlightClass = isTrackedHit ? 'bg-[hsl(var(--primary))]/10' : '';

                  return (
                    <>
                      <td data-index={index} className={cn(cellPadding, highlightClass)}>
                        <div className="flex flex-col">
                          <span className={cn('font-mono font-semibold text-foreground tabular-nums tracking-tight', monoTextClass)}>
                            {bet.nonce.toLocaleString()}
                          </span>
                          <span className={cn('text-[0.7rem] text-muted-foreground/70', secondaryLineClass)}>
                            {formatDate(bet.date_time)}
                          </span>
                        </div>
                      </td>
                      {showDateColumn && (
                        <td className={cn(cellPadding, highlightClass, 'text-left font-mono text-muted-foreground/80 tabular-nums tracking-tight', timestampTextClass)}>
                          {formatDate(bet.date_time)}
                        </td>
                      )}
                      <td
                        className={cn(
                          cellPadding,
                          'text-right font-mono font-semibold text-[hsl(var(--primary))] tabular-nums tracking-tight',
                          monoTextClass,
                          highlightClass,
                        )}
                      >
                        {bet.round_result.toFixed(2)}
                      </td>
                      {showDeltaColumn && (
                        <td
                          className={cn(
                            cellPadding,
                            'text-right font-mono tabular-nums tracking-tight',
                            monoTextClass,
                            highlightClass,
                            deltaInfo ? 'text-[hsl(var(--primary))]' : 'text-muted-foreground',
                          )}
                          title={deltaInfo ? `Gap between ${deltaInfo.multiplier.toFixed(2)}× hits` : undefined}
                        >
                          {deltaDisplay}
                        </td>
                      )}
                      <td
                        className={cn(
                          cellPadding,
                          'text-right font-mono font-semibold text-foreground tabular-nums tracking-tight',
                          monoTextClass,
                          highlightClass,
                        )}
                      >
                        {bet.amount.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          cellPadding,
                          'text-right font-mono font-semibold text-foreground tabular-nums tracking-tight',
                          monoTextClass,
                          highlightClass,
                        )}
                      >
                        {bet.payout.toFixed(2)}
                      </td>
                      {showDifficultyColumn && (
                        <td className={cn(cellPadding, 'text-left', highlightClass)}>
                          <Badge className={cn('capitalize border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide', toneClass)}>
                            {bet.difficulty}
                          </Badge>
                        </td>
                      )}
                      {showTargetColumn && (
                        <td
                          className={cn(
                            cellPadding,
                            'text-right font-mono text-muted-foreground tabular-nums tracking-tight',
                            monoTextClass,
                            highlightClass,
                          )}
                        >
                          {bet.round_target ?? '--'}
                        </td>
                      )}
                    </>
                  );
                }}
                style={{ height: '100%' }}
              />
            </div>

            {pendingCount > 0 && !isPinnedToTop && (
              <div className="pointer-events-none absolute left-0 right-0 top-4 z-20 flex justify-center">
                <Button
                  onClick={revealBufferedRows}
                  size="sm"
                  className="pointer-events-auto border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/20 px-3 text-[hsl(var(--primary))] shadow-md hover:bg-[hsl(var(--primary))]/30"
                >
                  Show {pendingCount} new bet{pendingCount > 1 ? 's' : ''}
                </Button>
              </div>
            )}

            {!isStreaming && (
              <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-warning-600/40 bg-warning-600/15 px-4 py-1 text-xs text-warning-500 shadow-md">
                Reconnecting to live feed…
              </div>
            )}

            {isFetchingNextPage && (
              <div className="absolute bottom-4 right-4 z-10 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground shadow-md">
                Loading older bets…
              </div>
            )}
          </div>
        </div>

        {showTrackingSummary && (
          <div className="xl:sticky xl:top-4">
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
      </div>
    </div>
  );
};

export default memo(LiveBetsTableComponent);
