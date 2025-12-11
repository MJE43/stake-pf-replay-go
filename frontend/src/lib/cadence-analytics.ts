/**
 * Cadence Analytics
 *
 * Core analytics engine for the Pump cadence strategy:
 * - Per-tier hit tracking and gap calculation
 * - Last-K hit analysis
 * - Rolling window statistics
 * - Consistency scoring
 * - Decision signals
 */

import {
  PumpTier,
  PUMP_EXPERT_TIERS,
  TIER_ORDER,
  TierId,
  CONSISTENCY_BANDS,
  getConsistencyGrade,
  ConsistencyGrade,
} from './pump-tiers';

// ============ Types ============

export interface TierHit {
  nonce: number;
  roundResult: number;
  timestamp?: string;
}

export interface TierGap {
  /** Gap = current hit nonce - previous hit nonce */
  gap: number;
  /** Deviation from expected (gap - expectedGap) */
  deviation: number;
  /** Nonce of the hit that ended this gap */
  atNonce: number;
}

export interface TierStats {
  tier: PumpTier;
  /** All recorded hits for this tier */
  hits: TierHit[];
  /** Calculated gaps between hits */
  gaps: TierGap[];
  /** Current streak: nonces since last hit */
  currentStreak: number;
  /** Progress toward expected gap (currentStreak / expectedGap) */
  streakProgress: number;
  /** Last K gaps for quick analysis */
  lastKGaps: TierGap[];
  /** Median gap from last K */
  medianGap: number | null;
  /** Mean gap from last K */
  meanGap: number | null;
  /** Standard deviation of last K gaps */
  stdDev: number | null;
  /** Percentage of gaps within ±normal band */
  consistencyPercent: number;
  /** Consistency grade (A/B/C/F) */
  consistencyGrade: ConsistencyGrade;
  /** Is the current streak "due" (> 80% of expected)? */
  isDue: boolean;
  /** Is the current streak "overdue" (> 100% of expected)? */
  isOverdue: boolean;
  /** Total hits observed */
  totalHits: number;
}

export interface SeedQuality {
  /** Overall consistency grade based on primary tier (1066) */
  grade: ConsistencyGrade;
  /** Human-readable assessment */
  assessment: string;
  /** Per-tier stats */
  tierStats: Map<TierId, TierStats>;
  /** Total nonces observed */
  totalNonces: number;
  /** Duration on this seed (if timestamps available) */
  durationMs: number | null;
  /** Overall recommendation */
  recommendation: 'ride' | 'caution' | 'rotate';
}

export interface DecisionSignal {
  type: 'hot' | 'due' | 'consistent' | 'inconsistent' | 'overdue';
  tier: TierId;
  message: string;
  severity: 'info' | 'warning' | 'success';
}

// ============ Configuration ============

/** Number of recent gaps to analyze */
const LAST_K_GAPS = 10;

/** Minimum hits required for meaningful stats */
const MIN_HITS_FOR_STATS = 3;

// ============ Core Analytics ============

/**
 * Extract hits for a specific tier from round data.
 * A hit is any round where roundResult >= tier.threshold.
 */
export function extractTierHits(
  rounds: Array<{ nonce: number; round_result: number; received_at?: string }>,
  tier: PumpTier
): TierHit[] {
  return rounds
    .filter(r => r.round_result >= tier.threshold)
    .map(r => ({
      nonce: r.nonce,
      roundResult: r.round_result,
      timestamp: r.received_at,
    }))
    .sort((a, b) => a.nonce - b.nonce);
}

/**
 * Calculate gaps between consecutive hits.
 */
export function calculateGaps(hits: TierHit[], expectedGap: number): TierGap[] {
  if (hits.length < 2) return [];

  const gaps: TierGap[] = [];
  for (let i = 1; i < hits.length; i++) {
    const gap = hits[i].nonce - hits[i - 1].nonce;
    gaps.push({
      gap,
      deviation: gap - expectedGap,
      atNonce: hits[i].nonce,
    });
  }
  return gaps;
}

/**
 * Calculate statistics for a set of gaps.
 */
function calculateGapStats(gaps: TierGap[]): {
  median: number | null;
  mean: number | null;
  stdDev: number | null;
} {
  if (gaps.length === 0) {
    return { median: null, mean: null, stdDev: null };
  }

  const values = gaps.map(g => g.gap);
  const sorted = [...values].sort((a, b) => a - b);

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Mean
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  // Standard deviation
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return { median, mean, stdDev };
}

/**
 * Calculate consistency percentage (% of gaps within ±normal band).
 */
function calculateConsistencyPercent(gaps: TierGap[], band: number): number {
  if (gaps.length === 0) return 100; // No data = assume consistent

  const withinBand = gaps.filter(g => Math.abs(g.deviation) <= band).length;
  return (withinBand / gaps.length) * 100;
}

/**
 * Compute full statistics for a tier.
 */
export function computeTierStats(
  rounds: Array<{ nonce: number; round_result: number; received_at?: string }>,
  tier: PumpTier,
  currentNonce: number
): TierStats {
  const hits = extractTierHits(rounds, tier);
  const gaps = calculateGaps(hits, tier.expectedGap);
  const lastKGaps = gaps.slice(-LAST_K_GAPS);

  const { median, mean, stdDev } = calculateGapStats(lastKGaps);
  const consistencyPercent = calculateConsistencyPercent(lastKGaps, CONSISTENCY_BANDS.normal);

  // Current streak
  const lastHitNonce = hits.length > 0 ? hits[hits.length - 1].nonce : 0;
  const currentStreak = currentNonce - lastHitNonce;
  const streakProgress = currentStreak / tier.expectedGap;

  // Consistency grade
  const consistencyGrade = stdDev !== null
    ? getConsistencyGrade(stdDev, tier.expectedGap)
    : 'A'; // No data = assume good

  return {
    tier,
    hits,
    gaps,
    currentStreak,
    streakProgress,
    lastKGaps,
    medianGap: median,
    meanGap: mean,
    stdDev,
    consistencyPercent,
    consistencyGrade,
    isDue: streakProgress >= 0.8,
    isOverdue: streakProgress >= 1.0,
    totalHits: hits.length,
  };
}

/**
 * Compute stats for all tiers.
 */
export function computeAllTierStats(
  rounds: Array<{ nonce: number; round_result: number; received_at?: string }>,
  currentNonce: number
): Map<TierId, TierStats> {
  const stats = new Map<TierId, TierStats>();

  for (const tierId of TIER_ORDER) {
    const tier = PUMP_EXPERT_TIERS[tierId];
    stats.set(tierId, computeTierStats(rounds, tier, currentNonce));
  }

  return stats;
}

/**
 * Evaluate overall seed quality.
 */
export function evaluateSeedQuality(
  rounds: Array<{ nonce: number; round_result: number; received_at?: string }>,
  currentNonce: number
): SeedQuality {
  const tierStats = computeAllTierStats(rounds, currentNonce);

  // Primary evaluation is based on T1066 (the main heuristic)
  const t1066Stats = tierStats.get('T1066')!;
  const grade = t1066Stats.consistencyGrade;

  // Calculate duration if timestamps available
  let durationMs: number | null = null;
  if (rounds.length >= 2) {
    const timestamps = rounds
      .map(r => r.received_at)
      .filter((t): t is string => !!t)
      .map(t => new Date(t).getTime());

    if (timestamps.length >= 2) {
      durationMs = Math.max(...timestamps) - Math.min(...timestamps);
    }
  }

  // Generate assessment
  let assessment: string;
  let recommendation: 'ride' | 'caution' | 'rotate';

  if (t1066Stats.totalHits < MIN_HITS_FOR_STATS) {
    assessment = `Gathering data... ${t1066Stats.totalHits} hits of 1066+ so far.`;
    recommendation = 'caution';
  } else {
    const avgGap = t1066Stats.meanGap ?? t1066Stats.tier.expectedGap;
    const dev = t1066Stats.stdDev ?? 0;

    switch (grade) {
      case 'A':
        assessment = `Excellent! 1066+ hitting every ~${Math.round(avgGap)} nonces (σ=±${Math.round(dev)}).`;
        recommendation = 'ride';
        break;
      case 'B':
        assessment = `Good seed. 1066+ averaging ~${Math.round(avgGap)} nonces (σ=±${Math.round(dev)}).`;
        recommendation = 'ride';
        break;
      case 'C':
        assessment = `Acceptable. 1066+ varies more (avg ${Math.round(avgGap)}, σ=±${Math.round(dev)}).`;
        recommendation = 'caution';
        break;
      case 'F':
      default:
        assessment = `Inconsistent seed. 1066+ gaps vary widely (σ=±${Math.round(dev)}).`;
        recommendation = 'rotate';
    }
  }

  return {
    grade,
    assessment,
    tierStats,
    totalNonces: currentNonce,
    durationMs,
    recommendation,
  };
}

/**
 * Generate decision signals based on current state.
 */
export function generateDecisionSignals(
  tierStats: Map<TierId, TierStats>
): DecisionSignal[] {
  const signals: DecisionSignal[] = [];

  // Check T1066 first (primary tier)
  const t1066 = tierStats.get('T1066');
  if (t1066) {
    if (t1066.isOverdue) {
      signals.push({
        type: 'overdue',
        tier: 'T1066',
        message: `1066+ overdue by ${t1066.currentStreak - t1066.tier.expectedGap} nonces`,
        severity: 'warning',
      });
    } else if (t1066.isDue) {
      signals.push({
        type: 'due',
        tier: 'T1066',
        message: `1066+ due soon (~${t1066.tier.expectedGap - t1066.currentStreak} nonces)`,
        severity: 'info',
      });
    }

    if (t1066.consistencyGrade === 'A' || t1066.consistencyGrade === 'B') {
      signals.push({
        type: 'consistent',
        tier: 'T1066',
        message: `Seed is ${t1066.consistencyGrade === 'A' ? 'very ' : ''}consistent`,
        severity: 'success',
      });
    } else if (t1066.consistencyGrade === 'F') {
      signals.push({
        type: 'inconsistent',
        tier: 'T1066',
        message: 'High variance detected — consider rotating',
        severity: 'warning',
      });
    }
  }

  // Check T3200 and T11200 for bonus signals
  const t3200 = tierStats.get('T3200');
  if (t3200 && t3200.isOverdue) {
    signals.push({
      type: 'overdue',
      tier: 'T3200',
      message: `3200+ overdue by ${t3200.currentStreak - t3200.tier.expectedGap} nonces`,
      severity: 'info',
    });
  }

  const t11200 = tierStats.get('T11200');
  if (t11200 && t11200.streakProgress >= 0.7) {
    signals.push({
      type: 'hot',
      tier: 'T11200',
      message: `11200+ approaching (${Math.round(t11200.streakProgress * 100)}% of expected)`,
      severity: 'info',
    });
  }

  return signals;
}

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format streak as percentage of expected.
 */
export function formatStreakProgress(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

/**
 * Get color class based on streak progress.
 */
export function getStreakColor(progress: number): string {
  if (progress >= 1.5) return 'text-red-500'; // Very overdue
  if (progress >= 1.0) return 'text-orange-500'; // Overdue
  if (progress >= 0.8) return 'text-amber-500'; // Due soon
  return 'text-emerald-500'; // Normal
}

/**
 * Get band status for a gap.
 */
export function getGapBandStatus(
  deviation: number
): 'tight' | 'normal' | 'loose' | 'outside' {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= CONSISTENCY_BANDS.tight) return 'tight';
  if (absDeviation <= CONSISTENCY_BANDS.normal) return 'normal';
  if (absDeviation <= CONSISTENCY_BANDS.loose) return 'loose';
  return 'outside';
}

