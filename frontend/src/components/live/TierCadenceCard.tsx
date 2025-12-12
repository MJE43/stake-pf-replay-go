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

const tierColors: Record<
  string,
  { accent: string; bg: string; bgSoft: string; ring: string }
> = {
  amber: {
    accent: "text-amber-400",
    bg: "bg-amber-500",
    bgSoft: "bg-amber-500/20",
    ring: "ring-amber-500/30",
  },
  orange: {
    accent: "text-orange-400",
    bg: "bg-orange-500",
    bgSoft: "bg-orange-500/20",
    ring: "ring-orange-500/30",
  },
  red: {
    accent: "text-red-400",
    bg: "bg-red-500",
    bgSoft: "bg-red-500/20",
    ring: "ring-red-500/30",
  },
  purple: {
    accent: "text-purple-400",
    bg: "bg-purple-500",
    bgSoft: "bg-purple-500/20",
    ring: "ring-purple-500/30",
  },
};

export function TierCadenceCard({ stats, className }: TierCadenceCardProps) {
  const {
    tier,
    currentStreak,
    streakProgress,
    lastKGaps,
    medianGap,
    meanGap,
    consistencyPercent,
    isDue,
    isOverdue,
    totalHits,
  } = stats;

  const colors = tierColors[tier.color] || tierColors.amber;
  const streakColor = getStreakColor(streakProgress);
  const TRACK_MAX_PROGRESS = 1.5; // show up to 150% of expected as full bar
  const fillPct =
    (Math.min(streakProgress, TRACK_MAX_PROGRESS) / TRACK_MAX_PROGRESS) * 100;
  const expectedMarkerPct = (1 / TRACK_MAX_PROGRESS) * 100;

  // Δ-to-expected (most important decision-support number)
  const deltaToExpected = tier.expectedGap - currentStreak; // positive => \"due in\", negative => \"overdue by\"
  const dueIn = Math.max(deltaToExpected, 0);
  const overdueBy = Math.max(-deltaToExpected, 0);

  // Consistency band score (last-K gaps within ±normal band)
  const withinNormalCount = useMemo(() => {
    if (lastKGaps.length === 0) return 0;
    return lastKGaps.filter(
      (g) => Math.abs(g.deviation) <= CONSISTENCY_BANDS.normal
    ).length;
  }, [lastKGaps]);

  // Calculate max gap for bar chart scaling
  const maxGapForChart = useMemo(() => {
    if (lastKGaps.length === 0) return tier.expectedGap * 2;
    const maxGap = Math.max(...lastKGaps.map((g) => g.gap));
    return Math.max(maxGap, tier.expectedGap * 1.5);
  }, [lastKGaps, tier.expectedGap]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              colors.bgSoft
            )}
          >
            <IconTarget size={16} className={colors.accent} />
          </div>
          <div>
            <div
              className={cn(
                "font-display text-sm font-semibold",
                colors.accent
              )}
            >
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
          <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className={cn(
                "h-full transition-all duration-500",
                streakProgress >= 1.0
                  ? "bg-gradient-to-r from-orange-500 to-red-500"
                  : "bg-gradient-to-r from-cyan-500 to-emerald-500"
              )}
              style={{ width: `${fillPct}%` }}
            />
            {/* Expected marker */}
            <div
              className="absolute top-0 h-2 w-0.5 bg-white/50"
              style={{ left: `${expectedMarkerPct}%` }}
            />
          </div>

          {/* Streak value */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("font-mono text-3xl font-bold", streakColor)}>
              {currentStreak.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              / {tier.expectedGap.toLocaleString()}
            </span>
          </div>

          {/* Δ-to-expected line (due in / overdue by) */}
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Δ expected</span>
            {lastKGaps.length === 0 ? (
              <span className="text-muted-foreground/60">—</span>
            ) : overdueBy > 0 ? (
              <span className="font-mono text-orange-300">
                overdue by {overdueBy.toLocaleString()}
              </span>
            ) : (
              <span className="font-mono text-emerald-300">
                due in {dueIn.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Gap history mini chart */}
        {lastKGaps.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last {lastKGaps.length} Gaps
            </div>
            <div className="relative">
              <div className="flex h-16 items-end gap-1">
                {lastKGaps.map((gap, i) => {
                  const bandStatus = getGapBandStatus(gap.deviation);
                  const height = (gap.gap / maxGapForChart) * 100;
                  const isRecent = i >= lastKGaps.length - 2;

                  const bandColors = {
                    tight: "bg-emerald-500",
                    normal: "bg-cyan-500",
                    loose: "bg-amber-500",
                    outside: "bg-red-500",
                  } as const;

                  return (
                    <div
                      key={i}
                      className="group relative flex-1"
                      title={`Gap: ${gap.gap} (${
                        gap.deviation >= 0 ? "+" : ""
                      }${gap.deviation})`}
                    >
                      <div
                        className={cn(
                          "w-full rounded-t ring-1 ring-white/10 transition-all",
                          bandColors[bandStatus],
                          isRecent ? "opacity-100" : "opacity-85"
                        )}
                        style={{ height: `${Math.max(height, 6)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Expected line (single line across chart) */}
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-white/30"
                style={{
                  bottom: `${(tier.expectedGap / maxGapForChart) * 100}%`,
                }}
              />
            </div>

            {/* Last-K gap number strip (fast eyeballing without hover) */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lastKGaps.slice(-10).map((g, idx) => {
                const bandStatus = getGapBandStatus(g.deviation);
                const pill = {
                  tight:
                    "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
                  normal: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25",
                  loose: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
                  outside: "bg-red-500/15 text-red-300 ring-red-500/25",
                } as const;
                return (
                  <span
                    key={`${g.atNonce}-${idx}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ring-1",
                      pill[bandStatus]
                    )}
                    title={`gap=${g.gap}, deviation=${
                      g.deviation >= 0 ? "+" : ""
                    }${g.deviation} @${g.atNonce}`}
                  >
                    <span className="font-mono">{g.gap}</span>
                    <span className="text-[9px] opacity-75">
                      ({g.deviation >= 0 ? "+" : ""}
                      {g.deviation})
                    </span>
                  </span>
                );
              })}
            </div>

            {/* Deviation bands legend */}
            <div className="mt-2 flex items-center justify-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />±
                {CONSISTENCY_BANDS.tight}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-cyan-500" />±
                {CONSISTENCY_BANDS.normal}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-amber-500" />±
                {CONSISTENCY_BANDS.loose}
              </span>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatMini label="Median" value={medianGap?.toLocaleString() ?? "—"} />
          <StatMini label="Mean" value={meanGap?.toFixed(0) ?? "—"} />
          <StatMini
            label="Consistency"
            value={`${consistencyPercent.toFixed(0)}%`}
            highlight={consistencyPercent >= 70}
          />
        </div>

        {/* Band score (explicit count within ±normal) */}
        {lastKGaps.length > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/15 px-2 py-1.5 text-[11px]">
            <span className="text-muted-foreground">
              within ±{CONSISTENCY_BANDS.normal}
            </span>
            <span
              className={cn(
                "font-mono",
                withinNormalCount / lastKGaps.length >= 0.7
                  ? "text-emerald-300"
                  : "text-amber-300"
              )}
            >
              {withinNormalCount}/{lastKGaps.length}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 bg-muted/10 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Hits</span>
          <span className={cn("font-mono font-semibold", colors.accent)}>
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

