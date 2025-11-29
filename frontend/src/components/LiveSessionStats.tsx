import { useMemo } from 'react';
import { IconArrowUpRight, IconArrowDownRight, IconActivity, IconCoin, IconTrophy, IconChartPie } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { LiveBet } from '@/types/live';

interface LiveSessionStatsProps {
  bets: LiveBet[];
  className?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function LiveSessionStats({ bets, className }: LiveSessionStatsProps) {
  const stats = useMemo(() => {
    let wagered = 0;
    let profit = 0;
    let wins = 0;
    let count = bets.length;

    for (const bet of bets) {
      wagered += bet.amount;
      const net = bet.payout - bet.amount;
      profit += net;
      if (net >= 0) wins++;
    }

    const rtp = wagered > 0 ? ((wagered + profit) / wagered) * 100 : 0;
    const winRate = count > 0 ? (wins / count) * 100 : 0;

    return { wagered, profit, rtp, winRate, count };
  }, [bets]);

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      <StatCard
        label="Net Profit"
        value={formatCurrency(stats.profit)}
        icon={IconActivity}
        trend={stats.profit >= 0 ? 'up' : 'down'}
        color={stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
      />
      <StatCard
        label="Total Wagered"
        value={formatCurrency(stats.wagered)}
        icon={IconCoin}
        color="text-blue-400"
      />
      <StatCard
        label="Win Rate"
        value={formatPercent(stats.winRate)}
        icon={IconTrophy}
        color="text-amber-400"
        subValue={`${stats.count} bets`}
      />
      <StatCard
        label="Observed RTP"
        value={formatPercent(stats.rtp)}
        icon={IconChartPie}
        color={stats.rtp >= 100 ? 'text-emerald-400' : 'text-slate-400'}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  color?: string;
}

function StatCard({ label, value, subValue, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-card/40 p-5 shadow-sm transition-all hover:bg-card/60 hover:shadow-md backdrop-blur-md">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{label}</span>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold tracking-tight", color || "text-foreground")}>
              {value}
            </span>
          </div>
          {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
        </div>
        <div className={cn("rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10 transition-transform group-hover:scale-110", color)}>
          <Icon size={20} />
        </div>
      </div>
      
      {/* Trend Indicator Background */}
      {trend && (
        <div className={cn(
          "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
          trend === 'up' ? "bg-emerald-500" : "bg-rose-500"
        )} />
      )}
    </div>
  );
}

