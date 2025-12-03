import { useMemo } from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Bar,
  BarChart,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { LiveBet } from '@/types/live';
import { IconTrendingUp, IconFlame, IconTarget } from '@tabler/icons-react';

interface MultiplierStreamProps {
  bets: LiveBet[];
  targetMultiplier: number;
  className?: string;
}

export function MultiplierStream({ bets, targetMultiplier, className }: MultiplierStreamProps) {
  const data = useMemo(() => {
    const sorted = [...bets].sort((a, b) => a.nonce - b.nonce);
    const recent = sorted.slice(-100);
    return recent.map((bet) => ({
      nonce: bet.nonce,
      multiplier: bet.round_result,
      isHit: bet.round_result >= targetMultiplier,
    }));
  }, [bets, targetMultiplier]);

  const stats = useMemo(() => {
    if (!data.length) return null;

    const hits = data.filter((d) => d.isHit);
    const lastHitIndex = data.findLastIndex((d) => d.isHit);
    const sinceLastHit = lastHitIndex >= 0 ? data.length - 1 - lastHitIndex : data.length;

    const hitIndices = data.map((d, i) => (d.isHit ? i : -1)).filter((i) => i >= 0);
    let avgGap = 0;
    if (hitIndices.length > 1) {
      const gaps = hitIndices.slice(1).map((idx, i) => idx - hitIndices[i]);
      avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }

    return {
      totalHits: hits.length,
      sinceLastHit,
      avgGap: Math.round(avgGap),
      hitRate: ((hits.length / data.length) * 100).toFixed(1),
    };
  }, [data]);

  const maxMultiplier = useMemo(() => {
    if (!data.length) return targetMultiplier;
    return Math.max(...data.map((d) => d.multiplier), targetMultiplier);
  }, [data, targetMultiplier]);

  return (
    <div className={cn('card-terminal overflow-hidden', className)}>
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-hit/30 bg-hit/10 text-hit">
              <IconTrendingUp size={16} />
            </div>
            <div>
              <h3 className="font-display text-xs uppercase tracking-wider text-foreground">Multiplier Stream</h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                Last {data.length} • Target: {targetMultiplier}×
              </p>
            </div>
          </div>

          {stats && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Since Last</div>
                <div
                  className={cn(
                    'font-mono text-xl font-bold',
                    stats.sinceLastHit > stats.avgGap * 1.5 ? 'text-hit hit-glow' : 'text-foreground'
                  )}
                >
                  {stats.sinceLastHit}
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Avg Gap</div>
                <div className="font-mono text-xl font-bold text-muted-foreground">{stats.avgGap || '—'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-4">
        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap={1}>
              <XAxis dataKey="nonce" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, Math.min(maxMultiplier * 1.1, 1000)]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={30}
                tickFormatter={(val: number) => (val >= 100 ? `${Math.round(val)}` : val.toFixed(1))}
              />
              <ReferenceLine y={targetMultiplier} stroke="hsl(var(--hit) / 0.5)" strokeDasharray="3 3" />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="border border-border bg-popover p-2 shadow-lg">
                        <p className="font-mono text-[10px] text-muted-foreground">Nonce #{d.nonce}</p>
                        <p className={cn('font-mono text-sm font-bold', d.isHit ? 'text-hit' : 'text-foreground')}>
                          {d.multiplier.toFixed(2)}×
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="multiplier" radius={[1, 1, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isHit ? 'hsl(var(--hit))' : 'hsl(var(--muted))'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
          <div className="bg-card px-4 py-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hits</div>
            <div className="font-mono text-lg font-bold text-hit">{stats.totalHits}</div>
          </div>
          <div className="bg-card px-4 py-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hit Rate</div>
            <div className="font-mono text-lg font-bold text-foreground">{stats.hitRate}%</div>
          </div>
          <div className="bg-card px-4 py-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Target</div>
            <div className="font-mono text-lg font-bold text-primary glow-sm">{targetMultiplier}×</div>
          </div>
        </div>
      )}
    </div>
  );
}

interface GapAnalysisProps {
  bets: LiveBet[];
  targetMultiplier: number;
  className?: string;
}

export function GapAnalysis({ bets, targetMultiplier, className }: GapAnalysisProps) {
  const analysis = useMemo(() => {
    const sorted = [...bets].sort((a, b) => a.nonce - b.nonce);
    const hits = sorted.filter((b) => b.round_result >= targetMultiplier);

    if (hits.length < 2) {
      return { gaps: [], avgGap: 0, maxGap: 0, minGap: 0, currentStreak: sorted.length };
    }

    const gaps: number[] = [];
    for (let i = 1; i < hits.length; i++) {
      gaps.push(hits[i].nonce - hits[i - 1].nonce - 1);
    }

    const lastHitNonce = hits[hits.length - 1].nonce;
    const lastBetNonce = sorted[sorted.length - 1]?.nonce ?? lastHitNonce;
    const currentStreak = lastBetNonce - lastHitNonce;

    return {
      gaps: gaps.slice(-20),
      avgGap: Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length),
      maxGap: Math.max(...gaps),
      minGap: Math.min(...gaps),
      currentStreak,
    };
  }, [bets, targetMultiplier]);

  const heatLevel = useMemo(() => {
    if (!analysis.avgGap) return 0;
    const ratio = analysis.currentStreak / analysis.avgGap;
    if (ratio >= 1.5) return 3;
    if (ratio >= 1.0) return 2;
    if (ratio >= 0.5) return 1;
    return 0;
  }, [analysis]);

  const heatConfig = [
    { label: 'Cold', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { label: 'Cool', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    { label: 'Warm', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    { label: 'Hot', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', pulse: true },
  ][heatLevel];

  return (
    <div className={cn('card-terminal', className)}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-8 w-8 items-center justify-center border', heatConfig.border, heatConfig.bg, heatConfig.color)}>
              <IconFlame size={16} className={heatConfig.pulse ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="font-display text-xs uppercase tracking-wider text-foreground">Gap Analysis</h3>
              <p className="font-mono text-[10px] text-muted-foreground">Predicting next {targetMultiplier}×</p>
            </div>
          </div>
          <span className={cn('font-mono text-[10px] uppercase tracking-widest', heatConfig.color)}>{heatConfig.label}</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Current Streak Progress */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current Streak</span>
            <span className="font-mono text-[10px] text-muted-foreground">Avg: {analysis.avgGap}</span>
          </div>
          <div className="h-2 w-full overflow-hidden border border-border bg-muted/30">
            <div
              className={cn(
                'h-full transition-all duration-500',
                heatLevel >= 2 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-primary to-cyan-400'
              )}
              style={{ width: `${Math.min((analysis.currentStreak / (analysis.avgGap * 2)) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className={cn('font-mono text-2xl font-bold', heatConfig.color)}>{analysis.currentStreak}</span>
            <span className="font-mono text-[10px] text-muted-foreground">/ {analysis.avgGap * 2} max expected</span>
          </div>
        </div>

        {/* Gap History */}
        {analysis.gaps.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gap History</div>
            <div className="flex h-12 items-end gap-0.5">
              {analysis.gaps.map((gap, i) => {
                const height = Math.min((gap / analysis.maxGap) * 100, 100);
                const isRecent = i >= analysis.gaps.length - 3;
                return (
                  <div
                    key={i}
                    className={cn('flex-1 transition-all', isRecent ? 'bg-primary' : 'bg-muted')}
                    style={{ height: `${Math.max(height, 10)}%` }}
                    title={`Gap: ${gap}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/30 p-2 text-center">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Min</div>
            <div className="font-mono text-sm font-bold text-foreground">{analysis.minGap || '—'}</div>
          </div>
          <div className="bg-muted/30 p-2 text-center">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Avg</div>
            <div className="font-mono text-sm font-bold text-foreground">{analysis.avgGap || '—'}</div>
          </div>
          <div className="bg-muted/30 p-2 text-center">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Max</div>
            <div className="font-mono text-sm font-bold text-foreground">{analysis.maxGap || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RecentHitsProps {
  bets: LiveBet[];
  targetMultiplier: number;
  className?: string;
}

export function RecentHits({ bets, targetMultiplier, className }: RecentHitsProps) {
  const hits = useMemo(() => {
    return bets
      .filter((b) => b.round_result >= targetMultiplier)
      .sort((a, b) => b.nonce - a.nonce)
      .slice(0, 10);
  }, [bets, targetMultiplier]);

  return (
    <div className={cn('card-terminal', className)}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
            <IconTarget size={16} />
          </div>
          <div>
            <h3 className="font-display text-xs uppercase tracking-wider text-foreground">Recent Hits</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Last {hits.length} times ≥ {targetMultiplier}×
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {hits.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-sm text-muted-foreground">
            No hits above {targetMultiplier}× yet
          </div>
        ) : (
          hits.map((hit, i) => (
            <div key={hit.id} className="data-row flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="font-mono text-sm text-foreground">#{hit.nonce.toLocaleString()}</span>
              </div>
              <span className="font-mono text-sm font-bold text-hit hit-glow">{hit.round_result.toFixed(2)}×</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

