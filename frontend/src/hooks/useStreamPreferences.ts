import { useCallback, useEffect, useState } from 'react';

export type RowDensity = 'comfortable' | 'compact';

export type ColumnKey = 'nonce' | 'result' | 'delta' | 'amount' | 'payout' | 'difficulty' | 'target' | 'date';

export type ColumnVisibility = Record<ColumnKey, boolean>;

export type TrackingPreferences = {
  enabled: boolean;
  multipliers: number[];
  activeKey: string | null;
};

export type StreamPreferences = {
  density: RowDensity;
  columns: ColumnVisibility;
  tracking: TrackingPreferences;
};

const DEFAULT_COLUMNS: ColumnVisibility = {
  nonce: true,
  result: true,
  delta: true,
  amount: true,
  payout: true,
  difficulty: true,
  target: false,
  date: true,
};

const DEFAULT_TRACKING: TrackingPreferences = {
  enabled: false,
  multipliers: [],
  activeKey: null,
};

const DEFAULT_PREFERENCES: StreamPreferences = {
  density: 'comfortable',
  columns: DEFAULT_COLUMNS,
  tracking: DEFAULT_TRACKING,
};

function getStorageKey(streamId: string): string {
  return `stake-pf:stream:${streamId}:preferences`;
}

function safeJSONParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeLocalStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn('Failed to read from localStorage', err);
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn('Failed to write to localStorage', err);
    return false;
  }
}

export function useStreamPreferences(streamId: string) {
  const [preferences, setPreferences] = useState<StreamPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storageKey = getStorageKey(streamId);
    const raw = safeLocalStorageGet(storageKey);
    const stored = safeJSONParse(raw, DEFAULT_PREFERENCES);

    const normalized: StreamPreferences = {
      density: stored.density === 'compact' || stored.density === 'comfortable' ? stored.density : 'comfortable',
      columns: { ...DEFAULT_COLUMNS, ...(stored.columns ?? {}) },
      tracking: {
        enabled: Boolean(stored.tracking?.enabled),
        multipliers: Array.isArray(stored.tracking?.multipliers)
          ? stored.tracking.multipliers
              .map((v: unknown) => Number(v))
              .filter((v: number) => Number.isFinite(v) && v > 0)
          : [],
        activeKey:
          stored.tracking?.activeKey && typeof stored.tracking.activeKey === 'string'
            ? stored.tracking.activeKey
            : null,
      },
    };

    setPreferences(normalized);
    setHydrated(true);
  }, [streamId]);

  useEffect(() => {
    if (!hydrated) return;

    const storageKey = getStorageKey(streamId);
    const payload = JSON.stringify(preferences);
    safeLocalStorageSet(storageKey, payload);
  }, [hydrated, streamId, preferences]);

  const setDensity = useCallback((density: RowDensity) => {
    setPreferences((prev) => ({ ...prev, density }));
  }, []);

  const setColumns = useCallback((columns: Partial<ColumnVisibility>) => {
    setPreferences((prev) => ({
      ...prev,
      columns: { ...prev.columns, ...columns },
    }));
  }, []);

  const setTracking = useCallback((tracking: Partial<TrackingPreferences>) => {
    setPreferences((prev) => ({
      ...prev,
      tracking: { ...prev.tracking, ...tracking },
    }));
  }, []);

  const addTrackedMultiplier = useCallback((value: number) => {
    setPreferences((prev) => {
      const normalized = Number(value.toFixed(2));
      const key = normalized.toFixed(2);
      if (prev.tracking.multipliers.some((v) => v.toFixed(2) === key)) {
        return {
          ...prev,
          tracking: {
            ...prev.tracking,
            activeKey: prev.tracking.activeKey ?? key,
          },
        };
      }
      const nextMultipliers = [...prev.tracking.multipliers, normalized].sort((a, b) => a - b);
      return {
        ...prev,
        tracking: {
          ...prev.tracking,
          multipliers: nextMultipliers,
          activeKey: prev.tracking.activeKey ?? key,
        },
      };
    });
  }, []);

  const removeTrackedMultiplier = useCallback((key: string) => {
    setPreferences((prev) => ({
      ...prev,
      tracking: {
        ...prev.tracking,
        multipliers: prev.tracking.multipliers.filter((v) => v.toFixed(2) !== key),
        activeKey: prev.tracking.activeKey === key ? null : prev.tracking.activeKey,
      },
    }));
  }, []);

  const setActiveMultiplierKey = useCallback((key: string | null) => {
    setPreferences((prev) => ({
      ...prev,
      tracking: { ...prev.tracking, activeKey: key },
    }));
  }, []);

  return {
    preferences,
    hydrated,
    setDensity,
    setColumns,
    setTracking,
    addTrackedMultiplier,
    removeTrackedMultiplier,
    setActiveMultiplierKey,
  };
}
