import { useCallback, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import type { LiveBet } from '@/types/live';

export type AlertConfig = {
  id: string;
  type: 'multiplier' | 'payout';
  threshold: number;
  enabled: boolean;
  sound?: boolean;
};

const DEFAULT_ALERTS: AlertConfig[] = [
  { id: 'high-mult', type: 'multiplier', threshold: 100, enabled: true, sound: true },
  { id: 'high-payout', type: 'payout', threshold: 1000, enabled: true, sound: true },
];

export function useLiveAlerts() {
  const [alerts, setAlerts] = useState<AlertConfig[]>(() => {
    const saved = localStorage.getItem('stake-pf-alerts');
    return saved ? JSON.parse(saved) : DEFAULT_ALERTS;
  });

  const saveAlerts = useCallback((newAlerts: AlertConfig[]) => {
    setAlerts(newAlerts);
    localStorage.setItem('stake-pf-alerts', JSON.stringify(newAlerts));
  }, []);

  const toggleAlert = useCallback((id: string) => {
    saveAlerts(alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, [alerts, saveAlerts]);

  const checkAlerts = useCallback((rows: LiveBet[]) => {
    if (!rows.length) return;

    // Play sound once per batch if needed
    let playSound = false;
    let highMultCount = 0;
    let highPayoutCount = 0;
    let maxMult = 0;
    let maxPayout = 0;

    const activeMultAlert = alerts.find(a => a.type === 'multiplier' && a.enabled);
    const activePayoutAlert = alerts.find(a => a.type === 'payout' && a.enabled);

    for (const row of rows) {
      if (activeMultAlert && row.round_result >= activeMultAlert.threshold) {
        highMultCount++;
        if (row.round_result > maxMult) maxMult = row.round_result;
        if (activeMultAlert.sound) playSound = true;
      }
      if (activePayoutAlert && row.payout >= activePayoutAlert.threshold) {
        highPayoutCount++;
        if (row.payout > maxPayout) maxPayout = row.payout;
        if (activePayoutAlert.sound) playSound = true;
      }
    }

    if (highMultCount > 0) {
      toast(`High Multiplier Alert!`, {
        description: `Hit ${maxMult.toFixed(2)}× (${highMultCount > 1 ? `+${highMultCount-1} others` : 'just now'})`,
        className: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
      });
    }

    if (highPayoutCount > 0) {
      toast(`Big Win Alert!`, {
        description: `Won $${maxPayout.toFixed(2)} (${highPayoutCount > 1 ? `+${highPayoutCount-1} others` : 'just now'})`,
        className: 'border-amber-500/50 bg-amber-500/10 text-amber-500',
      });
    }

    if (playSound) {
      // Simple beep or sound effect
      const audio = new Audio('/notification.mp3'); // We need to ensure this exists or use a data URI
      // Fallback to no sound if file missing, or use a beep function
      // For now, we skip actual audio implementation to avoid 404s
    }
  }, [alerts]);

  return {
    alerts,
    toggleAlert,
    checkAlerts,
  };
}
