import { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { cn } from '@/lib/utils';
import type { LiveBet } from '@/types/live';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { IconChartLine } from '@tabler/icons-react';

interface LivePnLChartProps {
  bets: LiveBet[];
  className?: string;
}

export function LivePnLChart({ bets, className }: LivePnLChartProps) {
  const data = useMemo(() => {
    // Sort bets by nonce or id to ensure correct order
    // Assuming bets might be in reverse chronological order if coming from recent list
    const sorted = [...bets].sort((a, b) => a.nonce - b.nonce);
    
    let runningPnL = 0;
    return sorted.map((bet) => {
      const profit = bet.payout - bet.amount;
      runningPnL += profit;
      return {
        nonce: bet.nonce,
        profit: runningPnL,
        rawProfit: profit, // for tooltip
      };
    });
  }, [bets]);

  const currentPnL = data.length > 0 ? data[data.length - 1].profit : 0;
  const isPositive = currentPnL >= 0;

  return (
    <Card className={cn("border-white/5 bg-card/40 backdrop-blur-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Session Performance
        </CardTitle>
        <IconChartLine className="text-muted-foreground/50" size={18} />
      </CardHeader>
      <CardContent className="pl-0 pr-4 pb-4">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "#00d4ff" : "#f43f5e"} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={isPositive ? "#00d4ff" : "#f43f5e"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="nonce" 
                type="number" 
                domain={['dataMin', 'dataMax']} 
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `#${val}`}
                minTickGap={30}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `$${val}`}
                width={40}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-white/10 bg-popover/90 p-3 shadow-xl backdrop-blur-md">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Nonce #{data.nonce}</p>
                        <p className={cn("text-sm font-bold", data.profit >= 0 ? "text-cyan-400" : "text-rose-400")}>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.profit)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="profit"
                stroke={isPositive ? "#00d4ff" : "#f43f5e"}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorProfit)"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

