/**
 * SeedQualityPanel
 *
 * Displays overall seed quality assessment at the top of the dashboard.
 * Shows consistency grade, assessment text, and key stats.
 */

import { IconAward, IconClock, IconHash, IconTarget } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/cadence-analytics';
import type { SeedQuality } from '@/lib/cadence-analytics';
import type { TierId } from '@/lib/pump-tiers';

interface SeedQualityPanelProps {
  quality: SeedQuality | null;
  currentNonce: number;
  isConnected: boolean;
  className?: string;
}

const gradeColors: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
  B: { bg: 'bg-sky-500/20', text: 'text-sky-400', ring: 'ring-sky-500/30' },
  C: { bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  F: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30' },
};

const recommendationConfig = {
  ride: { text: 'RIDE', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  caution: { text: 'CAUTION', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  rotate: { text: 'ROTATE', color: 'text-red-400', bg: 'bg-red-500/10' },
};

export function SeedQualityPanel({
  quality,
  currentNonce,
  isConnected,
  className,
}: SeedQualityPanelProps) {
  const grade = quality?.grade ?? 'A';
  const gradeStyle = gradeColors[grade] || gradeColors.A;
  const recommendation = quality?.recommendation ?? 'caution';
  const recConfig = recommendationConfig[recommendation];

  // Count tier hits
  const t1066Hits = quality?.tierStats.get('T1066')?.totalHits ?? 0;
  const t3200Hits = quality?.tierStats.get('T3200')?.totalHits ?? 0;
  const t11200Hits = quality?.tierStats.get('T11200')?.totalHits ?? 0;

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-white/5 bg-card/40 backdrop-blur-md', className)}>
      {/* Background gradient */}
      <div className={cn('absolute inset-0 opacity-30', gradeStyle.bg)} />

      <div className="relative p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Grade + Assessment */}
          <div className="flex items-start gap-4">
            {/* Grade badge */}
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-xl ring-2',
              gradeStyle.bg,
              gradeStyle.ring
            )}>
              <span className={cn('font-display text-3xl font-bold', gradeStyle.text)}>
                {quality ? grade : '—'}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-sm uppercase tracking-wider text-foreground">
                  Seed Quality
                </h2>
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  isConnected ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isConnected ? 'bg-cyan-400 animate-pulse' : 'bg-red-400'
                  )} />
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {quality?.assessment ?? 'Waiting for data...'}
              </p>

              {/* Recommendation badge */}
              {quality && (
                <div className={cn(
                  'mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider',
                  recConfig.bg,
                  recConfig.color
                )}>
                  <IconAward size={14} />
                  {recConfig.text}
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:gap-6">
            <StatItem
              icon={IconHash}
              label="Nonce"
              value={currentNonce > 0 ? currentNonce.toLocaleString() : '—'}
            />
            <StatItem
              icon={IconClock}
              label="Duration"
              value={quality?.durationMs ? formatDuration(quality.durationMs) : '—'}
            />
            <StatItem
              icon={IconTarget}
              label="1066+"
              value={t1066Hits.toString()}
              accent="amber"
            />
            <StatItem
              icon={IconTarget}
              label="3200+"
              value={t3200Hits.toString()}
              accent="orange"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: 'amber' | 'orange' | 'red';
}) {
  const accentColors = {
    amber: 'text-amber-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <span className={cn(
        'font-mono text-lg font-semibold',
        accent ? accentColors[accent] : 'text-foreground'
      )}>
        {value}
      </span>
    </div>
  );
}

