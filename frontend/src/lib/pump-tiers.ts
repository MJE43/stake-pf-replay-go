/**
 * Pump Expert Tier Constants
 *
 * These values come directly from the Pump expert multiplier table in backend/internal/games/pump.go.
 * The expected gaps are calculated from probability theory assuming independent rounds.
 */

export interface PumpTier {
  /** Unique tier identifier */
  id: string;
  /** Exact threshold from Pump expert table */
  threshold: number;
  /** Expected gap between hits (1 / probability) */
  expectedGap: number;
  /** Display label */
  label: string;
  /** CSS color class for theming */
  color: 'amber' | 'orange' | 'red' | 'purple';
  /** Safe pumps required to reach this tier */
  safePumps: number;
}

/**
 * Pump expert multiplier table (from backend/internal/games/pump.go)
 * Index = safe pumps, value = multiplier
 */
export const PUMP_EXPERT_TABLE = [
  1.00,      // 0 safe pumps
  1.63,      // 1
  2.80,      // 2
  4.95,      // 3
  9.08,      // 4
  17.34,     // 5
  34.68,     // 6
  73.21,     // 7
  164.72,    // 8
  400.02,    // 9
  1066.73,   // 10
  3200.18,   // 11
  11200.65,  // 12
  48536.13,  // 13
  291216.80, // 14
  3203384.80 // 15
] as const;

/**
 * Calculate probability of reaching a given safe pump count.
 *
 * In Pump expert: K=25 positions, M=10 POP tokens.
 * P(safe_pumps >= n) = C(25-n, 10) / C(25, 10)
 */
function calculateProbability(safePumps: number): number {
  const K = 25; // Total positions
  const M = 10; // POP tokens (expert)

  // Binomial coefficient C(n, k)
  function binomial(n: number, k: number): number {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1);
    }
    return result;
  }

  // P(pop_point > safePumps) = P(min of M positions > safePumps)
  // = C(K - safePumps, M) / C(K, M)
  return binomial(K - safePumps, M) / binomial(K, M);
}

/**
 * Primary tiers we track for the cadence strategy.
 *
 * These are the multipliers that matter for your "~1000 nonce cadence" heuristic.
 */
export const PUMP_EXPERT_TIERS: Record<string, PumpTier> = {
  T164: {
    id: 'T164',
    threshold: 164.72,
    expectedGap: Math.round(1 / calculateProbability(8)),
    label: '164×',
    color: 'amber',
    safePumps: 8,
  },
  T400: {
    id: 'T400',
    threshold: 400.02,
    expectedGap: Math.round(1 / calculateProbability(9)),
    label: '400×',
    color: 'amber',
    safePumps: 9,
  },
  T1066: {
    id: 'T1066',
    threshold: 1066.73,
    expectedGap: Math.round(1 / calculateProbability(10)),
    label: '1066×',
    color: 'orange',
    safePumps: 10,
  },
  T3200: {
    id: 'T3200',
    threshold: 3200.18,
    expectedGap: Math.round(1 / calculateProbability(11)),
    label: '3200×',
    color: 'red',
    safePumps: 11,
  },
  T11200: {
    id: 'T11200',
    threshold: 11200.65,
    expectedGap: Math.round(1 / calculateProbability(12)),
    label: '11200×',
    color: 'purple',
    safePumps: 12,
  },
} as const;

/** Ordered list of tier IDs for iteration */
export const TIER_ORDER = ['T164', 'T400', 'T1066', 'T3200', 'T11200'] as const;
export type TierId = (typeof TIER_ORDER)[number];

/** Get tier by ID */
export function getTier(id: TierId): PumpTier {
  return PUMP_EXPERT_TIERS[id];
}

/** Get all tiers as an array (ordered) */
export function getAllTiers(): PumpTier[] {
  return TIER_ORDER.map(id => PUMP_EXPERT_TIERS[id]);
}

/**
 * Consistency bands for gap deviation.
 *
 * Based on your heuristic: 1066+ should appear every ~1000 nonces ±200-400.
 */
export const CONSISTENCY_BANDS = {
  /** Excellent: within ±200 of expected */
  tight: 200,
  /** Good: within ±400 of expected */
  normal: 400,
  /** Acceptable: within ±600 of expected */
  loose: 600,
} as const;

/**
 * Determine if a round result matches a tier (>= threshold).
 */
export function matchesTier(roundResult: number, tier: PumpTier): boolean {
  return roundResult >= tier.threshold;
}

/**
 * Get the highest tier that a round result qualifies for.
 * Returns null if below all tracked tiers.
 */
export function getHighestMatchingTier(roundResult: number): PumpTier | null {
  // Check in reverse order (highest first)
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = PUMP_EXPERT_TIERS[TIER_ORDER[i]];
    if (roundResult >= tier.threshold) {
      return tier;
    }
  }
  return null;
}

/**
 * Get all tiers that a round result qualifies for.
 */
export function getAllMatchingTiers(roundResult: number): PumpTier[] {
  return getAllTiers().filter(tier => roundResult >= tier.threshold);
}

/**
 * Format a gap value relative to expected.
 */
export function formatGapDeviation(gap: number, expectedGap: number): string {
  const diff = gap - expectedGap;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff}`;
}

/**
 * Get consistency grade based on gap variance.
 */
export type ConsistencyGrade = 'A' | 'B' | 'C' | 'F';

export function getConsistencyGrade(stdDev: number, expectedGap: number): ConsistencyGrade {
  const ratio = stdDev / expectedGap;
  if (ratio <= 0.15) return 'A'; // Very consistent
  if (ratio <= 0.25) return 'B'; // Good
  if (ratio <= 0.40) return 'C'; // Acceptable
  return 'F'; // Inconsistent
}

