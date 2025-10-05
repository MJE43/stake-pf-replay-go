import { useMemo } from 'react';
import { IconChartBar, IconClockHour3, IconTarget, IconTimeline } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TrackedHit = {
  rowId: number;
  nonce: number;
  multiplier: number;
  delta: number | null;
  at?: string;
};

export type MultiplierOption = {
  key: string;
  value: number;
  hitCount: number;
};

type MultiplierDeltaSummaryProps = {
  multipliers: MultiplierOption[];
  activeKey: string | null;
  onSelectMultiplier: (key: string) => void;
  hits: TrackedHit[];
  totalHitCount: number;
  onJumpToHit?: (hit: TrackedHit) => void;
};

function formatMultiplierLabel(value: number) {
  return `${value.toFixed(2)}×`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown timestamp';
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return value;
  }
}

export default function MultiplierDeltaSummary({
  multipliers,
  activeKey,
  onSelectMultiplier,
  hits,
  totalHitCount,
  onJumpToHit,
}: MultiplierDeltaSummaryProps) {
  const activeOption = useMemo(() => multipliers.find((item) => item.key === activeKey) ?? null, [multipliers, activeKey]);

  const { median, mean, latestDelta, sampleSize, deltas } = useMemo(() => {
    const numericDeltas = hits
      .map((hit) => hit.delta)
      .filter((delta): delta is number => typeof delta === 'number' && Number.isFinite(delta));
    const sorted = [...numericDeltas].sort((a, b) => a - b);
    let medianValue: number | null = null;
    if (sorted.length) {
      const middle = Math.floor(sorted.length / 2);
      medianValue = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
    }
    const meanValue = sorted.length ? sorted.reduce((total, value) => total + value, 0) / sorted.length : null;
    const latest = hits.length ? hits[0].delta ?? null : null;
    return {
      median: medianValue,
      mean: meanValue,
      latestDelta: latest,
      sampleSize: sorted.length,
      deltas: sorted,
    };
  }, [hits]);

  if (!activeOption) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
        Select a multiplier to see recent hits and nonce deltas.
      </div>
    );
  }

  const formattedLabel = formatMultiplierLabel(activeOption.value);

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4 shadow-sm xl:max-h-[calc(100vh-220px)] xl:overflow-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Tracking summary</span>
          <span className="text-base font-semibold text-foreground">{formattedLabel}</span>
          <span className="text-xs text-muted-foreground/80">
            Showing the most recent hits with recorded nonce deltas. Captured {totalHitCount.toLocaleString()} hit{totalHitCount === 1 ? '' : 's'} overall.
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {multipliers.map((option) => {
            const label = formatMultiplierLabel(option.value);
            const isActive = option.key === activeOption.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectMultiplier(option.key)}
                className={cn(
                  'rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/40',
                  isActive && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <IconClockHour3 size={14} /> Latest Δ
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {typeof latestDelta === 'number' ? latestDelta.toLocaleString() : '—'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground/80">Bets since the most recent hit of {formattedLabel}.</p>
        </div>
        <div className="rounded-md border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <IconTimeline size={14} /> Median Δ
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {typeof median === 'number' ? median.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground/80">Middle gap across the sampled hits.</p>
        </div>
        <div className="rounded-md border border-border/60 bg-card/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <IconChartBar size={14} /> Mean Δ
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {typeof mean === 'number' ? mean.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground/80">Average gap across {sampleSize} recorded delta{sampleSize === 1 ? '' : 's'}.</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="flex items-center gap-2">
            <IconTarget size={14} /> Recent hits
          </span>
          <span>{Math.min(hits.length, 10)} most recent</span>
        </div>

        {hits.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-card/60 p-3 text-xs text-muted-foreground/80">
            Waiting for the first hit of {formattedLabel}.
          </div>
        ) : (
          <div className="divide-y divide-border/40 overflow-hidden rounded-md border border-border/60 bg-card/80">
            {hits.map((hit) => {
              const deltaDisplay = typeof hit.delta === 'number' ? hit.delta.toLocaleString() : '—';
              return (
                <button
                  key={hit.rowId}
                  type="button"
                  onClick={() => onJumpToHit?.(hit)}
                  className="flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--primary))]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]">
                        Nonce {hit.nonce.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground/80">
                      Δ {deltaDisplay}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground/60">{formatDateTime(hit.at)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
