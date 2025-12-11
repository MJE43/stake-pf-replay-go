/**
 * TierCadenceCard
 *
 * Displays cadence statistics for a single multiplier tier.
 * Shows current streak, expected gap, progress bar, last gaps, and consistency.
 */

import { useMemo } from 'react';
import { IconFlame, IconTarget, IconTrendingUp } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { getStreakColor, formatStreakProgress, getGapBandStatus } from '@/lib/cadence-analytics';
import type { TierStats } from '@/lib/cadence-analytics';
import { CONSISTENCY_BANDS } from '@/lib/pump-tiers';

interface TierCadenceCardProps {
  stats: TierStats;
  className?: string;
}

const tierColors: Record<string, { accent: string; bg: string; ring: string }> = {
  amber: { accent: 'text-amber-400', bg: 'bg-amber-500', ring: 'ring-amber-500/30' },
  orange: { accent: 'text-orange-400', bg: 'bg-orange-500', ring: 'ring-orange-500/30' },
  red: { accent: 'text-red-400', bg: 'bg-red-500', ring: 'ring-red-500/30' },
  purple: { accent: 'text-purple-400', bg: 'bg-purple-500', ring: 'ring-purple-500/30' },
};

export function TierCadenceCard({ stats, className }: TierCadenceCardProps) {
  const { tier, currentStreak, streakProgress, lastKGaps, medianGap, meanGap, consistencyPercent, isDue, isOverdue, totalHits } = stats;

  const colors = tierColors[tier.color] || tierColors.amber;
  const streakColor = getStreakColor(streakProgress);

  // Calculate max gap for bar chart scaling
  const maxGapForChart = useMemo(() => {
    if (lastKGaps.length === 0) return tier.expectedGap * 2;
    const maxGap = Math.max(...lastKGaps.map(g => g.gap));
    return Math.max(maxGap, tier.expectedGap * 1.5);
  }, [lastKGaps, tier.expectedGap]);

  return (
    <div className={cn(
      'flex flex-col rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colors.bg + '/20')}>
            <IconTarget size={16} className={colors.accent} />
          </div>
          <div>
            <div className={cn('font-display text-sm font-semibold', colors.accent)}>
              {tier.label}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Expected: ~{tier.expectedGap.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {isOverdue && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              <IconFlame size={12} className="animate-pulse" />
              OVERDUE
            </span>
          )}
          {isDue && !isOverdue && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              <IconTrendingUp size={12} />
              DUE
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4">
        {/* Current streak section */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current Streak
            </span>
            <span className="text-xs text-muted-foreground">
              {formatStreakProgress(streakProgress)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className={cn(
                'h-full transition-all duration-500',
                streakProgress >= 1.0
                  ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
              )}
              style={{ width: `${Math.min(streakProgress * 100, 150)}%` }}
            />
            {/* Expected marker */}
            <div
              className="relative -mt-2 h-2 w-0.5 bg-white/50"
              style={{ left: `${Math.min(100 / Math.max(streakProgress * 1.5, 1), 66.67)}%` }}
            />
          </div>

          {/* Streak value */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn('font-mono text-3xl font-bold', streakColor)}>
              {currentStreak.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              / {tier.expectedGap.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Gap history mini chart */}
        {lastKGaps.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last {lastKGaps.length} Gaps
            </div>
            <div className="flex h-16 items-end gap-1">
              {lastKGaps.map((gap, i) => {
                const bandStatus = getGapBandStatus(gap.deviation);
                const height = (gap.gap / maxGapForChart) * 100;
                const isRecent = i >= lastKGaps.length - 2;

                const bandColors = {
                  tight: 'bg-emerald-500',
                  normal: 'bg-cyan-500',
                  loose: 'bg-amber-500',
                  outside: 'bg-red-500',
                };

                return (
                  <div
                    key={i}
                    className="group relative flex-1"
                    title={`Gap: ${gap.gap} (${gap.deviation >= 0 ? '+' : ''}${gap.deviation})`}
                  >
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        bandColors[bandStatus],
                        isRecent ? 'opacity-100' : 'opacity-60'
                      )}
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                    {/* Expected line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-white/30"
                      style={{ bottom: `${(tier.expectedGap / maxGapForChart) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Deviation bands legend */}
            <div className="mt-2 flex items-center justify-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                ±{CONSISTENCY_BANDS.tight}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-cyan-500" />
                ±{CONSISTENCY_BANDS.normal}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-amber-500" />
                ±{CONSISTENCY_BANDS.loose}
              </span>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatMini label="Median" value={medianGap?.toLocaleString() ?? '—'} />
          <StatMini label="Mean" value={meanGap?.toFixed(0) ?? '—'} />
          <StatMini
            label="Consistency"
            value={`${consistencyPercent.toFixed(0)}%`}
            highlight={consistencyPercent >= 70}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 bg-muted/10 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Hits</span>
          <span className={cn('font-mono font-semibold', colors.accent)}>
            {totalHits.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatMini({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/20 px-2 py-1.5 text-center">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn(
        'font-mono text-sm font-semibold',
        highlight ? 'text-emerald-400' : 'text-foreground'
      )}>
        {value}
      </div>
    </div>
  );
}

