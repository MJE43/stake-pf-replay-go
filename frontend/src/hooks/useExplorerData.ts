/**
 * useExplorerData - Unified data hook for Live Explorer table
 *
 * Manages both Rounds (heartbeat) and Bets (tape) mode with:
 * - Initial load from Wails bindings
 * - Live tail updates via Wails events
 * - Client-side filtering/sorting
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EventsOn } from "@wails/runtime/runtime";
import {
  GetRecentRounds,
  TailRounds,
  GetBetsPage,
  Tail,
} from "@wails/go/livehttp/LiveModule";
import type { livestore } from "@wails/go/models";

// ============ Types ============

export type ExplorerMode = "rounds" | "bets";

export interface ExplorerRow {
  id: number;
  nonce: number;
  round_result: number;
  received_at?: string;
  // Bet-specific fields (optional)
  amount?: number;
  payout?: number;
  difficulty?: string;
  round_target?: number | null;
  date_time?: string;
}

export interface DerivedRow extends ExplorerRow {
  deltaPrev: number | null;
  tierGap: number | null;
}

export interface ExplorerFilters {
  minMultiplier: number | null;
  maxMultiplier: number | null;
  minNonce: number | null;
  maxNonce: number | null;
}

export interface UseExplorerDataOptions {
  streamId: string;
  mode: ExplorerMode;
  initialLimit?: number;
}

export interface UseExplorerDataResult {
  rows: ExplorerRow[];
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
  totalCount: number;
  refresh: () => void;
}

// ============ Helpers ============

function mapRound(r: livestore.LiveRound): ExplorerRow {
  return {
    id: r.id,
    nonce: r.nonce,
    round_result: r.round_result,
    received_at: typeof r.received_at === "string" ? r.received_at : undefined,
  };
}

function mapBet(b: livestore.LiveBet): ExplorerRow {
  return {
    id: b.id,
    nonce: b.nonce,
    round_result: b.round_result,
    amount: b.amount,
    payout: b.payout,
    difficulty: b.difficulty,
    round_target: b.round_target ?? null,
    date_time: typeof b.date_time === "string" ? b.date_time : undefined,
    received_at: typeof b.received_at === "string" ? b.received_at : undefined,
  };
}

// ============ Hook ============

export function useExplorerData({
  streamId,
  mode,
  initialLimit = 10000,
}: UseExplorerDataOptions): UseExplorerDataResult {
  const [rows, setRows] = useState<ExplorerRow[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const lastNonceRef = useRef(0);
  const lastIdRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  // Initial data fetch
  const {
    data: initialData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["explorer-data", streamId, mode, initialLimit],
    queryFn: async () => {
      if (mode === "rounds") {
        const rounds = await GetRecentRounds(streamId, initialLimit);
        return rounds.map(mapRound);
      } else {
        // GetBetsPage(streamId, minMultiplier, order, limit, offset)
        const page = await GetBetsPage(streamId, 0, "desc", initialLimit, 0);
        return page.rows.map(mapBet);
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Set initial data
  useEffect(() => {
    if (initialData) {
      setRows(initialData);
      if (initialData.length > 0) {
        // Find max nonce and max id for tailing
        const maxNonce = Math.max(...initialData.map((r) => r.nonce));
        const maxId = Math.max(...initialData.map((r) => r.id));
        lastNonceRef.current = maxNonce;
        lastIdRef.current = maxId;
      }
      lastUpdateRef.current = Date.now();
      setIsConnected(true);
    }
  }, [initialData]);

  // Handle live updates for rounds
  const handleTick = useCallback(
    async (_event: { nonce: number; roundResult: number }) => {
      if (mode !== "rounds") return;

      lastUpdateRef.current = Date.now();
      setIsConnected(true);

      // Fetch new rounds since last known nonce
      try {
        const result = await TailRounds(streamId, lastNonceRef.current, 100);
        if (result.rows && result.rows.length > 0) {
          const mapped = result.rows.map(mapRound);
          setRows((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const uniqueNew = mapped.filter((r) => !existingIds.has(r.id));
            if (uniqueNew.length === 0) return prev;
            lastNonceRef.current = Math.max(
              lastNonceRef.current,
              ...uniqueNew.map((r) => r.nonce)
            );
            return [...uniqueNew, ...prev];
          });
        }
      } catch (err) {
        console.error("Failed to tail rounds:", err);
      }
    },
    [streamId, mode]
  );

  // Handle live updates for bets
  const handleNewRows = useCallback(
    async (_event: { nonce?: number }) => {
      if (mode !== "bets") return;

      lastUpdateRef.current = Date.now();
      setIsConnected(true);

      // Fetch new bets since last known id
      try {
        const result = await Tail(streamId, lastIdRef.current, 100);
        if (result.rows && result.rows.length > 0) {
          const mapped = result.rows.map(mapBet);
          setRows((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const uniqueNew = mapped.filter((r) => !existingIds.has(r.id));
            if (uniqueNew.length === 0) return prev;
            lastIdRef.current = Math.max(
              lastIdRef.current,
              ...uniqueNew.map((r) => r.id)
            );
            lastNonceRef.current = Math.max(
              lastNonceRef.current,
              ...uniqueNew.map((r) => r.nonce)
            );
            return [...uniqueNew, ...prev];
          });
        }
      } catch (err) {
        console.error("Failed to tail bets:", err);
      }
    },
    [streamId, mode]
  );

  // Subscribe to Wails events
  useEffect(() => {
    const offTick = EventsOn(`live:tick:${streamId}`, handleTick);
    const offNewRows = EventsOn(`live:newrows:${streamId}`, handleNewRows);

    // Connection timeout check
    const checkInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
      if (timeSinceLastUpdate > 30_000) {
        setIsConnected(false);
      }
    }, 10_000);

    return () => {
      offTick();
      offNewRows();
      clearInterval(checkInterval);
    };
  }, [streamId, handleTick, handleNewRows]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    rows,
    isLoading,
    error: error as Error | null,
    isConnected,
    totalCount: rows.length,
    refresh,
  };
}

// ============ Derived Column Computation ============

/**
 * Compute derived columns (Δprev and tierGap) for explorer rows.
 *
 * @param rows - Raw rows (nonce DESC by default)
 * @param tierThreshold - The tier threshold for tier-aware gap calculation
 */
export function computeDerivedColumns(
  rows: ExplorerRow[],
  tierThreshold: number
): DerivedRow[] {
  if (rows.length === 0) return [];

  // Sort by nonce ASC for computing tier gaps
  const sortedAsc = [...rows].sort((a, b) => a.nonce - b.nonce);

  // Build tier gap map: for each row, find distance to previous tier hit
  const tierGapMap = new Map<number, number | null>();
  let lastTierHitNonce: number | null = null;

  for (const row of sortedAsc) {
    if (row.round_result >= tierThreshold) {
      if (lastTierHitNonce !== null) {
        tierGapMap.set(row.id, row.nonce - lastTierHitNonce);
      } else {
        tierGapMap.set(row.id, null); // First hit in window
      }
      lastTierHitNonce = row.nonce;
    } else {
      tierGapMap.set(row.id, null);
    }
  }

  // Compute deltaPrev based on display order (DESC by default)
  const result: DerivedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prevRow = rows[i + 1]; // Next in DESC order = previous in time
    const deltaPrev = prevRow ? row.nonce - prevRow.nonce : null;

    result.push({
      ...row,
      deltaPrev,
      tierGap: tierGapMap.get(row.id) ?? null,
    });
  }

  return result;
}

/**
 * Apply filters to explorer rows.
 */
export function applyFilters(
  rows: ExplorerRow[],
  filters: ExplorerFilters
): ExplorerRow[] {
  return rows.filter((row) => {
    if (
      filters.minMultiplier !== null &&
      row.round_result < filters.minMultiplier
    ) {
      return false;
    }
    if (
      filters.maxMultiplier !== null &&
      row.round_result > filters.maxMultiplier
    ) {
      return false;
    }
    if (filters.minNonce !== null && row.nonce < filters.minNonce) {
      return false;
    }
    if (filters.maxNonce !== null && row.nonce > filters.maxNonce) {
      return false;
    }
    return true;
  });
}

/**
 * Sort rows by a given key.
 */
export type SortKey = "nonce" | "round_result" | "deltaPrev" | "tierGap";
export type SortDir = "asc" | "desc";

export function sortRows(
  rows: DerivedRow[],
  sortKey: SortKey,
  sortDir: SortDir
): DerivedRow[] {
  return [...rows].sort((a, b) => {
    let aVal: number | null = null;
    let bVal: number | null = null;

    switch (sortKey) {
      case "nonce":
        aVal = a.nonce;
        bVal = b.nonce;
        break;
      case "round_result":
        aVal = a.round_result;
        bVal = b.round_result;
        break;
      case "deltaPrev":
        aVal = a.deltaPrev;
        bVal = b.deltaPrev;
        break;
      case "tierGap":
        aVal = a.tierGap;
        bVal = b.tierGap;
        break;
    }

    // Handle nulls - push to end
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    const diff = aVal - bVal;
    return sortDir === "asc" ? diff : -diff;
  });
}
