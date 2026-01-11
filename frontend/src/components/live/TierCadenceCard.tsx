/**
 * TierCadenceCard
 *
 * Displays cadence statistics for a single multiplier tier.
 * Simplified for live play: current streak + last 10 gaps (no predictions).
 */

import { useMemo } from 'react';
import { IconTarget } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { getStreakColor, getGapBandStatus } from '@/lib/cadence-analytics';
import type { TierStats } from '@/lib/cadence-analytics';

interface TierCadenceCardProps {
  stats: TierStats;
  className?: string;
  /** Compact mode for narrower cards (5-column layout) */
  compact?: boolean;
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

export function TierCadenceCard({ stats, className, compact }: TierCadenceCardProps) {
  const {
    tier,
    currentStreak,
    streakProgress,
    lastKGaps,
  } = stats;

  const colors = tierColors[tier.color] || tierColors.amber;
  const streakColor = getStreakColor(streakProgress);
  const TRACK_MAX_PROGRESS = 1.5; // show up to 150% of expected as full bar
  const fillPct =
    (Math.min(streakProgress, TRACK_MAX_PROGRESS) / TRACK_MAX_PROGRESS) * 100;

  // Calculate max gap for bar chart scaling
  const maxGapForChart = useMemo(() => {
    if (lastKGaps.length === 0) return 1;
    const maxGap = Math.max(...lastKGaps.map((g) => g.gap));
    return Math.max(maxGap, 1);
  }, [lastKGaps]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-white/5",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center justify-center rounded-lg",
              compact ? "h-6 w-6" : "h-8 w-8",
              colors.bgSoft
            )}
          >
            <IconTarget size={compact ? 12 : 16} className={colors.accent} />
          </div>
          <div
            className={cn(
              "font-display font-semibold",
              compact ? "text-xs" : "text-sm",
              colors.accent
            )}
          >
            {tier.label}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={cn("flex-1", compact ? "p-3" : "p-4")}>
        {/* Current streak section */}
        <div className={compact ? "mb-2" : "mb-3"}>
          <span className={cn(
            "font-medium uppercase tracking-wider text-muted-foreground",
            compact ? "text-[10px]" : "text-xs"
          )}>
            Current Streak
          </span>

          {/* Progress bar */}
          <div className={cn(
            "relative w-full overflow-hidden rounded-full bg-muted/30",
            compact ? "mt-1.5 h-1.5" : "mt-2 h-2"
          )}>
            <div
              className={cn(
                "h-full transition-all duration-500",
                streakProgress >= 1.0
                  ? "bg-gradient-to-r from-orange-500 to-red-500"
                  : "bg-gradient-to-r from-cyan-500 to-sky-500"
              )}
              style={{ width: `${fillPct}%` }}
            />
          </div>

          {/* Streak value */}
          <div className={cn("flex items-baseline", compact ? "mt-1" : "mt-2")}>
            <span className={cn(
              "font-mono font-bold",
              compact ? "text-2xl" : "text-3xl",
              streakColor
            )}>
              {currentStreak.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Past gaps */}
        {lastKGaps.length > 0 && (
          <div>
            <div className={cn(
              "font-medium uppercase tracking-wider text-muted-foreground",
              compact ? "mb-1.5 text-[10px]" : "mb-2 text-xs"
            )}>
              Last 10 Gaps
            </div>

            <div className="relative">
              <div className={cn(
                "flex items-end gap-0.5",
                compact ? "h-8" : "h-12"
              )}>
                {lastKGaps.slice(-10).map((gap, i) => {
                  const bandStatus = getGapBandStatus(gap.deviation);
                  const height = (gap.gap / maxGapForChart) * 100;
                  const bandColors = {
                    tight: "bg-cyan-500",
                    normal: "bg-sky-500",
                    loose: "bg-amber-500",
                    outside: "bg-red-500",
                  } as const;

                  return (
                    <div
                      key={`${gap.atNonce}-${i}`}
                      className="group relative flex-1"
                      title={`Gap: ${gap.gap.toLocaleString()}`}
                    >
                      <div
                        className={cn(
                          "w-full rounded-t ring-1 ring-white/10 transition-all",
                          bandColors[bandStatus]
                        )}
                        style={{ height: `${Math.max(height, 6)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {lastKGaps.slice(-10).map((g, idx) => {
                const bandStatus = getGapBandStatus(g.deviation);
                const pill = {
                  tight: "bg-cyan-500/15 text-cyan-100 ring-cyan-500/30",
                  normal: "bg-sky-500/15 text-sky-100 ring-sky-500/30",
                  loose: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
                  outside: "bg-red-500/15 text-red-100 ring-red-500/30",
                } as const;
                return (
                  <span
                    key={`${g.atNonce}-${idx}`}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md ring-1",
                      compact ? "min-w-[42px] px-1.5 py-1 text-xs" : "px-2.5 py-1 text-sm",
                      "font-semibold",
                      pill[bandStatus]
                    )}
                    title={`Gap: ${g.gap.toLocaleString()}`}
                  >
                    <span className="font-mono">{g.gap.toLocaleString()}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
