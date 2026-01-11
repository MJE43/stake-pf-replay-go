/**
 * LiveStreamTape
 *
 * Displays a scrollable tape of high-multiplier hits (>= 34x).
 * Shows nonce, multiplier, tier badge, delta since last same-tier hit, and time.
 */

import { useMemo, useRef, useEffect } from 'react';
import { IconArrowUp, IconClock } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { getHighestMatchingTier, PUMP_EXPERT_TIERS, TierId, TIER_ORDER } from '@/lib/pump-tiers';
import type { LiveBet } from '@/types/live';

interface LiveStreamTapeProps {
  bets: LiveBet[];
  maxItems?: number;
  className?: string;
}

const tierBadgeColors: Record<string, string> = {
  T164: 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
  T400: 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
  T1066: 'bg-orange-500/20 text-orange-400 ring-orange-500/30',
  T3200: 'bg-red-500/20 text-red-400 ring-red-500/30',
  T11200: 'bg-purple-500/20 text-purple-400 ring-purple-500/30',
};

export function LiveStreamTape({ bets, maxItems = 100, className }: LiveStreamTapeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtTopRef = useRef(true);

  // Compute deltas for each tier
  const betsWithDeltas = useMemo(() => {
    // Sort by nonce descending (most recent first)
    const sorted = [...bets].sort((a, b) => b.nonce - a.nonce).slice(0, maxItems);

    // Track last seen nonce for each tier (going backwards through sorted list)
    const lastNonceByTier: Partial<Record<TierId, number>> = {};

    // Process in reverse (oldest first) to calculate deltas correctly
    const reversed = [...sorted].reverse();
    const withDeltas: Array<LiveBet & { tier: TierId | null; delta: number | null }> = [];

    for (const bet of reversed) {
      const tier = getHighestMatchingTier(bet.round_result);
      let delta: number | null = null;

      if (tier) {
        const tierId = tier.id as TierId;
        const lastNonce = lastNonceByTier[tierId];
        if (lastNonce !== undefined) {
          delta = bet.nonce - lastNonce;
        }
        lastNonceByTier[tierId] = bet.nonce;
      }

      withDeltas.push({
        ...bet,
        tier: tier ? (tier.id as TierId) : null,
        delta,
      });
    }

    // Return in descending order (most recent first)
    return withDeltas.reverse();
  }, [bets, maxItems]);

  // Auto-scroll to top when new items arrive (if user was at top)
  useEffect(() => {
    if (containerRef.current && wasAtTopRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [betsWithDeltas.length]);

  const handleScroll = () => {
    if (containerRef.current) {
      wasAtTopRef.current = containerRef.current.scrollTop < 10;
    }
  };

  if (bets.length === 0) {
    return (
      <div
        className={cn(
          'h-full min-h-0 rounded-xl border border-white/5 bg-card/40 backdrop-blur-md p-8 text-center',
          className
        )}
      >
        <IconArrowUp size={24} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No high-multiplier hits yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Hits ≥34× will appear here</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Stream Tape
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {bets.length.toLocaleString()} hits
        </span>
      </div>

      {/* Table */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Nonce</th>
              <th className="px-3 py-2 text-right font-medium">Result</th>
              <th className="px-3 py-2 text-center font-medium">Tier</th>
              <th className="px-3 py-2 text-right font-medium">Δ Gap</th>
              <th className="px-3 py-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {betsWithDeltas.map((bet, i) => (
              <tr
                key={bet.id}
                className={cn(
                  'transition-colors hover:bg-white/5',
                  i === 0 && 'bg-primary/5'
                )}
              >
                <td className="px-3 py-2">
                  <span className="font-mono text-foreground">
                    #{bet.nonce.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn(
                    'font-mono font-semibold',
                    bet.tier ? tierBadgeColors[bet.tier]?.split(' ')[1] : 'text-foreground'
                  )}>
                    {bet.round_result.toFixed(2)}×
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {bet.tier && (
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                      tierBadgeColors[bet.tier]
                    )}>
                      {PUMP_EXPERT_TIERS[bet.tier].label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {bet.delta !== null ? (
                    <span className="font-mono text-muted-foreground">
                      {bet.delta.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <IconClock size={10} />
                    {formatTime(bet.date_time)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

