import { useMemo } from 'react';
import {
  Area,
  AreaChart,
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
    // Sort bets by nonce ascending for the chart
    const sorted = [...bets].sort((a, b) => a.nonce - b.nonce);
    
    // Take last 100 for the stream view
    const recent = sorted.slice(-100);
    
    return recent.map((bet) => ({
      nonce: bet.nonce,
      multiplier: bet.round_result,
      isHit: bet.round_result >= targetMultiplier,
    }));
  }, [bets, targetMultiplier]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    
    const hits = data.filter(d => d.isHit);
    const lastHitIndex = data.findLastIndex(d => d.isHit);
    const sinceLastHit = lastHitIndex >= 0 ? data.length - 1 - lastHitIndex : data.length;
    
    // Calculate average gap between hits
    const hitIndices = data.map((d, i) => d.isHit ? i : -1).filter(i => i >= 0);
    let avgGap = 0;
    if (hitIndices.length > 1) {
      const gaps = hitIndices.slice(1).map((idx, i) => idx - hitIndices[i]);
      avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }

    return {
      totalHits: hits.length,
      sinceLastHit,
      avgGap: Math.round(avgGap),
      hitRate: (hits.length / data.length * 100).toFixed(1),
    };
  }, [data]);

  const maxMultiplier = useMemo(() => {
    if (!data.length) return targetMultiplier;
    return Math.max(...data.map(d => d.multiplier), targetMultiplier);
  }, [data, targetMultiplier]);

  return (
    <div className={cn("rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden", className)}>
      {/* Header with key stats */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <IconTrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Multiplier Stream</h3>
              <p className="text-[10px] text-muted-foreground">Last {data.length} results • Target: {targetMultiplier}×</p>
            </div>
          </div>
          
          {stats && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Since Last Hit</div>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  stats.sinceLastHit > stats.avgGap * 1.5 ? "text-amber-400" : "text-foreground"
                )}>
                  {stats.sinceLastHit}
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Gap</div>
                <div className="text-xl font-bold font-mono text-muted-foreground">{stats.avgGap || '—'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual Stream - Bar chart showing multipliers */}
      <div className="px-4 py-4">
        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap={1}>
              <XAxis 
                dataKey="nonce" 
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[0, Math.min(maxMultiplier * 1.1, 1000)]}
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                width={30}
                tickFormatter={(val: number) => val >= 100 ? `${Math.round(val)}` : val.toFixed(1)}
              />
              <ReferenceLine y={targetMultiplier} stroke="rgba(251, 191, 36, 0.5)" strokeDasharray="3 3" />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-white/10 bg-popover/95 p-2 shadow-xl backdrop-blur-md">
                        <p className="text-[10px] text-muted-foreground">Nonce #{d.nonce}</p>
                        <p className={cn("text-sm font-bold font-mono", d.isHit ? "text-amber-400" : "text-foreground")}>
                          {d.multiplier.toFixed(2)}×
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="multiplier" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isHit ? 'rgb(251, 191, 36)' : 'rgba(255, 255, 255, 0.15)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats Footer */}
      {stats && (
        <div className="grid grid-cols-3 gap-px bg-white/5">
          <div className="bg-card/60 px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hits</div>
            <div className="text-lg font-bold text-amber-400">{stats.totalHits}</div>
          </div>
          <div className="bg-card/60 px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hit Rate</div>
            <div className="text-lg font-bold text-foreground">{stats.hitRate}%</div>
          </div>
          <div className="bg-card/60 px-4 py-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
            <div className="text-lg font-bold text-primary">{targetMultiplier}×</div>
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
    const hits = sorted.filter(b => b.round_result >= targetMultiplier);
    
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
      gaps: gaps.slice(-20), // Last 20 gaps for display
      avgGap: Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length),
      maxGap: Math.max(...gaps),
      minGap: Math.min(...gaps),
      currentStreak,
    };
  }, [bets, targetMultiplier]);

  const heatLevel = useMemo(() => {
    if (!analysis.avgGap) return 0;
    const ratio = analysis.currentStreak / analysis.avgGap;
    if (ratio >= 1.5) return 3; // HOT
    if (ratio >= 1.0) return 2; // WARM
    if (ratio >= 0.5) return 1; // COOL
    return 0; // COLD
  }, [analysis]);

  const heatConfig = [
    { label: 'Cold', color: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30' },
    { label: 'Cool', color: 'text-cyan-400', bg: 'bg-cyan-500/20', ring: 'ring-cyan-500/30' },
    { label: 'Warm', color: 'text-orange-400', bg: 'bg-orange-500/20', ring: 'ring-orange-500/30' },
    { label: 'Hot', color: 'text-red-400', bg: 'bg-red-500/20', ring: 'ring-red-500/30', pulse: true },
  ][heatLevel];

  return (
    <div className={cn("rounded-xl border border-white/5 bg-card/40 backdrop-blur-md", className)}>
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg ring-1", heatConfig.bg, heatConfig.ring, heatConfig.color)}>
              <IconFlame size={18} className={heatConfig.pulse ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Gap Analysis</h3>
              <p className="text-[10px] text-muted-foreground">Predicting next {targetMultiplier}× occurrence</p>
            </div>
          </div>
          <div className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider", heatConfig.bg, heatConfig.color)}>
            {heatConfig.label}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Streak Indicator */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Current Streak</span>
            <span className="text-xs text-muted-foreground">Avg: {analysis.avgGap}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                heatLevel >= 2 ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-gradient-to-r from-blue-500 to-cyan-500"
              )}
              style={{ width: `${Math.min((analysis.currentStreak / (analysis.avgGap * 2)) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className={cn("text-2xl font-bold font-mono", heatConfig.color)}>{analysis.currentStreak}</span>
            <span className="text-xs text-muted-foreground">/ {analysis.avgGap * 2} max expected</span>
          </div>
        </div>

        {/* Gap History Mini Chart */}
        {analysis.gaps.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Recent Gap History</div>
            <div className="flex items-end gap-0.5 h-12">
              {analysis.gaps.map((gap, i) => {
                const height = Math.min((gap / analysis.maxGap) * 100, 100);
                const isRecent = i >= analysis.gaps.length - 3;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-t transition-all",
                      isRecent ? "bg-primary" : "bg-white/20"
                    )}
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
          <div className="rounded-lg bg-white/5 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Min</div>
            <div className="text-sm font-bold font-mono text-foreground">{analysis.minGap || '—'}</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg</div>
            <div className="text-sm font-bold font-mono text-foreground">{analysis.avgGap || '—'}</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Max</div>
            <div className="text-sm font-bold font-mono text-foreground">{analysis.maxGap || '—'}</div>
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
      .filter(b => b.round_result >= targetMultiplier)
      .sort((a, b) => b.nonce - a.nonce)
      .slice(0, 10);
  }, [bets, targetMultiplier]);

  return (
    <div className={cn("rounded-xl border border-white/5 bg-card/40 backdrop-blur-md", className)}>
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <IconTarget size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Recent Hits</h3>
            <p className="text-[10px] text-muted-foreground">Last {hits.length} times ≥ {targetMultiplier}×</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {hits.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hits above {targetMultiplier}× yet
          </div>
        ) : (
          hits.map((hit, i) => (
            <div key={hit.id} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="font-mono text-sm text-foreground">#{hit.nonce.toLocaleString()}</span>
              </div>
              <span className="font-mono text-sm font-bold text-amber-400">{hit.round_result.toFixed(2)}×</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

