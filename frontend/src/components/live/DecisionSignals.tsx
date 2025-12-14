/**
 * DecisionSignals
 *
 * Displays active decision support signals for start/stop timing.
 * Shows hot indicators, due warnings, consistency status.
 */

import { IconAlertTriangle, IconCheck, IconFlame, IconInfoCircle, IconTrendingUp } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { DecisionSignal } from '@/lib/cadence-analytics';

interface DecisionSignalsProps {
  signals: DecisionSignal[];
  className?: string;
}

const signalConfig: Record<DecisionSignal['type'], {
  icon: React.ElementType;
  defaultBg: string;
  defaultText: string;
}> = {
  hot: {
    icon: IconFlame,
    defaultBg: 'bg-orange-500/20',
    defaultText: 'text-orange-400',
  },
  due: {
    icon: IconTrendingUp,
    defaultBg: 'bg-amber-500/20',
    defaultText: 'text-amber-400',
  },
  overdue: {
    icon: IconAlertTriangle,
    defaultBg: 'bg-red-500/20',
    defaultText: 'text-red-400',
  },
  consistent: {
    icon: IconCheck,
    defaultBg: 'bg-cyan-500/20',
    defaultText: 'text-cyan-400',
  },
  inconsistent: {
    icon: IconAlertTriangle,
    defaultBg: 'bg-red-500/20',
    defaultText: 'text-red-400',
  },
};

const severityStyles: Record<DecisionSignal['severity'], { bg: string; text: string; ring: string }> = {
  info: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/30',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/30',
  },
  success: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/30',
  },
};

export function DecisionSignals({ signals, className }: DecisionSignalsProps) {
  if (signals.length === 0) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg border border-white/5 bg-card/40 px-4 py-2.5 text-sm text-muted-foreground',
        className
      )}>
        <IconInfoCircle size={16} />
        <span>Monitoring seed behavior...</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {signals.map((signal, i) => {
        const config = signalConfig[signal.type];
        const severity = severityStyles[signal.severity];
        const Icon = config.icon;

        return (
          <div
            key={`${signal.type}-${signal.tier}-${i}`}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1',
              severity.bg,
              severity.ring
            )}
          >
            <Icon
              size={14}
              className={cn(
                severity.text,
                signal.type === 'hot' || signal.type === 'overdue' ? 'animate-pulse' : ''
              )}
            />
            <span className={severity.text}>
              {signal.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact version for sticky header/footer
 */
export function DecisionSignalsCompact({ signals, className }: DecisionSignalsProps) {
  // Show only the most important signals (max 3)
  const priorityOrder: DecisionSignal['type'][] = ['overdue', 'inconsistent', 'hot', 'due', 'consistent'];

  const sortedSignals = [...signals].sort((a, b) => {
    return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
  }).slice(0, 3);

  if (sortedSignals.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {sortedSignals.map((signal, i) => {
        const config = signalConfig[signal.type];
        const severity = severityStyles[signal.severity];
        const Icon = config.icon;

        return (
          <div
            key={`${signal.type}-${signal.tier}-${i}`}
            className="flex items-center gap-1.5"
            title={signal.message}
          >
            <Icon
              size={14}
              className={cn(
                severity.text,
                signal.type === 'hot' || signal.type === 'overdue' ? 'animate-pulse' : ''
              )}
            />
            <span className={cn('text-xs font-medium', severity.text)}>
              {signal.tier}
            </span>
          </div>
        );
      })}
    </div>
  );
}

