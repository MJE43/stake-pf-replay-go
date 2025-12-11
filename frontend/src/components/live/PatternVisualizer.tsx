/**
 * PatternVisualizer
 *
 * Displays a bar chart of recent rounds from heartbeat data.
 * Color-coded by tier to help visualize clustering and rhythm.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { IconZoomIn, IconZoomOut, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { getHighestMatchingTier, PUMP_EXPERT_TIERS, TierId } from '@/lib/pump-tiers';
import { Button } from '@/components/ui/button';

interface Round {
  nonce: number;
  round_result: number;
}

interface PatternVisualizerProps {
  rounds: Round[];
  maxBars?: number;
  className?: string;
}

const tierBarColors: Record<TierId, string> = {
  T164: 'bg-amber-500',
  T400: 'bg-amber-500',
  T1066: 'bg-orange-500',
  T3200: 'bg-red-500',
  T11200: 'bg-purple-500',
};

const TIER_THRESHOLDS: Array<{ min: number; color: string; label: string }> = [
  { min: 11200.65, color: 'bg-purple-500', label: '11200+' },
  { min: 3200.18, color: 'bg-red-500', label: '3200+' },
  { min: 1066.73, color: 'bg-orange-500', label: '1066+' },
  { min: 400.02, color: 'bg-amber-500', label: '400+' },
  { min: 164.72, color: 'bg-amber-400', label: '164+' },
  { min: 34, color: 'bg-cyan-500', label: '34+' },
  { min: 0, color: 'bg-muted', label: '<34' },
];

function getBarColor(roundResult: number): string {
  for (const threshold of TIER_THRESHOLDS) {
    if (roundResult >= threshold.min) {
      return threshold.color;
    }
  }
  return 'bg-muted';
}

export function PatternVisualizer({
  rounds,
  maxBars = 200,
  className,
}: PatternVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hoveredBar, setHoveredBar] = useState<Round | null>(null);

  // Sort and slice rounds
  const displayRounds = useMemo(() => {
    const sorted = [...rounds].sort((a, b) => a.nonce - b.nonce);
    return sorted.slice(-maxBars);
  }, [rounds, maxBars]);

  // Calculate bar dimensions
  const barWidth = useMemo(() => {
    const base = 4;
    return base * zoom;
  }, [zoom]);

  // Calculate max value for scaling (log scale for better visibility)
  const maxValue = useMemo(() => {
    if (displayRounds.length === 0) return 1;
    const max = Math.max(...displayRounds.map(r => r.round_result));
    return Math.max(max, 100);
  }, [displayRounds]);

  // Auto-scroll to end when new data arrives (if not paused)
  useEffect(() => {
    if (!isPaused && containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [displayRounds.length, isPaused]);

  if (rounds.length === 0) {
    return (
      <div className={cn(
        'rounded-xl border border-white/5 bg-card/40 backdrop-blur-md p-8 text-center',
        className
      )}>
        <p className="text-sm text-muted-foreground">Waiting for round data...</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Heartbeat data will appear here</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pattern Visualizer
          </span>
          <span className="rounded bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Last {displayRounds.length} rounds
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
          >
            <IconZoomOut size={14} />
          </Button>
          <span className="text-xs text-muted-foreground w-8 text-center">{zoom}×</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
          >
            <IconZoomIn size={14} />
          </Button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', isPaused && 'text-amber-400')}
            onClick={() => setIsPaused(p => !p)}
          >
            {isPaused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="relative h-32 overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="flex h-full items-end gap-px p-2"
          style={{ minWidth: displayRounds.length * (barWidth + 1) }}
        >
          {displayRounds.map((round, i) => {
            // Use log scale for better visibility of smaller values
            const logValue = Math.log10(Math.max(round.round_result, 1) + 1);
            const logMax = Math.log10(maxValue + 1);
            const heightPercent = (logValue / logMax) * 100;
            const color = getBarColor(round.round_result);

            return (
              <div
                key={`${round.nonce}-${i}`}
                className="group relative flex-shrink-0"
                style={{ width: barWidth }}
                onMouseEnter={() => setHoveredBar(round)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                <div
                  className={cn(
                    'w-full rounded-t transition-all duration-75',
                    color,
                    hoveredBar?.nonce === round.nonce ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                  )}
                  style={{ height: `${Math.max(heightPercent, 2)}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {hoveredBar && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-lg bg-card border border-white/10 px-3 py-2 text-xs shadow-xl pointer-events-none z-10">
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">#{hoveredBar.nonce}</span>
              <span className={cn(
                'font-mono font-semibold',
                getBarColor(hoveredBar.round_result).replace('bg-', 'text-')
              )}>
                {hoveredBar.round_result.toFixed(2)}×
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/5 px-3 py-2 text-[9px]">
        {TIER_THRESHOLDS.slice(0, -1).map(t => (
          <span key={t.label} className="flex items-center gap-1 text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-sm', t.color)} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

