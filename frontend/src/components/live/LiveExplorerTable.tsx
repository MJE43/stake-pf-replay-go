/**
 * LiveExplorerTable
 *
 * Full-height virtualized table for manual pattern/trend exploration.
 * Supports both Rounds (heartbeat) and Bets (tape) modes with:
 * - Δprev column (nonce delta from previous row)
 * - TierGap column (gap since last hit of selected tier)
 * - Client-side sorting and filtering
 */

import { forwardRef, memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { TableVirtuoso, TableVirtuosoHandle, TableComponents } from "react-virtuoso";
import {
  IconSortAscending,
  IconSortDescending,
  IconFilter,
  IconFilterOff,
  IconRefresh,
  IconTable,
  IconList,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconTarget,
  IconChartBar,
  IconDeviceFloppy,
  IconX,
  IconPlayerPlay,
  IconAlertTriangle,
  IconBolt,
  IconArrowsExchange,
  IconMathAvg,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useExplorerData,
  computeDerivedColumns,
  applyFilters,
  applyDerivedFilters,
  sortRows,
  computeCrossTierStats,
  DEFAULT_FILTERS,
  hasActiveFilters,
  countActiveFilters,
  TIER_BUCKET_THRESHOLDS,
  GAP_DEVIATION_BANDS,
  type ExplorerMode,
  type ExplorerFilters,
  type ExplorerRow,
  type DerivedRow,
  type SortKey,
  type SortDir,
  type TierBucket,
  type GapDeviationBand,
  type CrossTierStats,
} from "@/hooks/useExplorerData";
import { PUMP_EXPERT_TIERS, TIER_ORDER, type TierId } from "@/lib/pump-tiers";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ============ Table Components for Virtuoso ============

const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<"table">>(
  ({ style, className, ...props }, ref) => (
    <table
      ref={ref}
      style={style}
      className={cn(
        "w-full border-separate border-spacing-0 text-left text-sm leading-6 text-foreground/85",
        className
      )}
      {...props}
    />
  )
);
Table.displayName = "Table";

const TableHead = forwardRef<
  HTMLTableSectionElement,
  ComponentPropsWithoutRef<"thead">
>(({ style, className, ...props }, ref) => (
  <thead
    ref={ref}
    style={style}
    className={cn(
      "sticky top-0 z-10 bg-card/95 backdrop-blur-sm text-[0.65rem] md:text-xs uppercase tracking-[0.12em] text-muted-foreground",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableRow = forwardRef<HTMLTableRowElement, ComponentPropsWithoutRef<"tr">>(
  ({ style, className, ...props }, ref) => (
    <tr
      ref={ref}
      style={style}
      className={cn(
        "group border-b border-border/40 bg-card/70 transition-colors hover:bg-muted/50",
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

const TableBody = forwardRef<
  HTMLTableSectionElement,
  ComponentPropsWithoutRef<"tbody">
>(({ style, className, ...props }, ref) => (
  <tbody ref={ref} style={style} className={cn("bg-card", className)} {...props} />
));
TableBody.displayName = "TableBody";

const tableComponents: TableComponents<DerivedRow> = {
  Table,
  TableHead,
  TableRow,
  TableBody,
};

// ============ Tier Thresholds for Display ============

const TIER_OPTIONS = [
  { id: "T164" as TierId, label: "164+", threshold: 164.72 },
  { id: "T400" as TierId, label: "400+", threshold: 400.02 },
  { id: "T1066" as TierId, label: "1066+", threshold: 1066.73 },
  { id: "T3200" as TierId, label: "3200+", threshold: 3200.18 },
  { id: "T11200" as TierId, label: "11200+", threshold: 11200.65 },
];

// ============ Color Coding ============

function getMultiplierColor(value: number): string {
  if (value >= 11200.65) return "text-purple-400";
  if (value >= 3200.18) return "text-red-400";
  if (value >= 1066.73) return "text-orange-400";
  if (value >= 400.02) return "text-amber-400";
  if (value >= 164.72) return "text-amber-300";
  if (value >= 34) return "text-cyan-400";
  return "text-muted-foreground";
}

function getTierGapColor(gap: number | null, expectedGap: number): string {
  if (gap === null) return "text-muted-foreground/50";
  const deviation = Math.abs(gap - expectedGap);
  if (deviation <= 200) return "text-cyan-400";
  if (deviation <= 400) return "text-cyan-400";
  if (deviation <= 600) return "text-amber-400";
  return "text-red-400";
}

// ============ Props ============

interface LiveExplorerTableProps {
  streamId: string;
  className?: string;
}

// ============ Component ============

function LiveExplorerTableComponent({ streamId, className }: LiveExplorerTableProps) {
  const virtuosoRef = useRef<TableVirtuosoHandle>(null);

  // State
  const [mode, setMode] = useState<ExplorerMode>("rounds");
  const [selectedTier, setSelectedTier] = useState<TierId>("T1066");
  const [sortKey, setSortKey] = useState<SortKey>("nonce");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<ExplorerFilters>({ ...DEFAULT_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [jumpToNonce, setJumpToNonce] = useState("");

  // Filter panel section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    tier: false,
    gap: false,
    time: false,
    pattern: false,
  });

  // Filter input state (debounced for text inputs)
  const [filterInputs, setFilterInputs] = useState({
    minMultiplier: "",
    maxMultiplier: "",
    minNonce: "",
    maxNonce: "",
    minTierGap: "",
    maxTierGap: "",
    minDeltaPrev: "",
    maxDeltaPrev: "",
    lastNMinutes: "",
    startDate: "",
    endDate: "",
    minCrossTierGap: "",
    maxCrossTierGap: "",
  });

  // Saved filter presets
  const [savedPresets, setSavedPresets] = useState<Record<string, ExplorerFilters>>(() => {
    try {
      const saved = localStorage.getItem("explorer-filter-presets");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [presetName, setPresetName] = useState("");

  // Data hook
  const { rows, isLoading, error, isConnected, totalCount, refresh } = useExplorerData({
    streamId,
    mode,
    initialLimit: 10000,
  });

  // Get tier info
  const tierInfo = PUMP_EXPERT_TIERS[selectedTier];
  const tierThreshold = tierInfo?.threshold ?? 1066.73;
  const expectedGap = tierInfo?.expectedGap ?? 1088;

  // Get cross-tier reference threshold
  const crossTierRefThreshold = useMemo(() => {
    if (!filters.crossTierRef || filters.crossTierRef === 'all') return null;
    return TIER_BUCKET_THRESHOLDS[filters.crossTierRef]?.min ?? null;
  }, [filters.crossTierRef]);

  const filterOptions = useMemo(() => ({ tierThreshold, expectedGap }), [tierThreshold, expectedGap]);

  // Apply basic filters
  const filteredRows = useMemo(() => {
    return applyFilters(rows, filters, filterOptions);
  }, [rows, filters, filterOptions]);

  // Compute derived columns (including cross-tier gaps)
  const derivedRows = useMemo(() => {
    return computeDerivedColumns(filteredRows, {
      tierThreshold,
      crossTierRefThreshold,
    });
  }, [filteredRows, tierThreshold, crossTierRefThreshold]);

  // Apply derived-column filters (gap, delta, pattern, cross-tier)
  const derivedFilteredRows = useMemo(() => {
    return applyDerivedFilters(derivedRows, filters, filterOptions);
  }, [derivedRows, filters, filterOptions]);

  // Sort rows
  const sortedRows = useMemo(() => {
    return sortRows(derivedFilteredRows, sortKey, sortDir);
  }, [derivedFilteredRows, sortKey, sortDir]);

  // Cross-tier statistics
  const crossTierStats = useMemo<CrossTierStats | null>(() => {
    if (!filters.crossTierRef) return null;
    return computeCrossTierStats(derivedFilteredRows, tierThreshold);
  }, [derivedFilteredRows, tierThreshold, filters.crossTierRef]);

  // Active filter count
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const filtersActive = activeFilterCount > 0;

  // Debounce text filter inputs
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        minMultiplier: filterInputs.minMultiplier
          ? parseFloat(filterInputs.minMultiplier)
          : null,
        maxMultiplier: filterInputs.maxMultiplier
          ? parseFloat(filterInputs.maxMultiplier)
          : null,
        minNonce: filterInputs.minNonce
          ? parseInt(filterInputs.minNonce, 10)
          : null,
        maxNonce: filterInputs.maxNonce
          ? parseInt(filterInputs.maxNonce, 10)
          : null,
        minTierGap: filterInputs.minTierGap
          ? parseInt(filterInputs.minTierGap, 10)
          : null,
        maxTierGap: filterInputs.maxTierGap
          ? parseInt(filterInputs.maxTierGap, 10)
          : null,
        minDeltaPrev: filterInputs.minDeltaPrev
          ? parseInt(filterInputs.minDeltaPrev, 10)
          : null,
        maxDeltaPrev: filterInputs.maxDeltaPrev
          ? parseInt(filterInputs.maxDeltaPrev, 10)
          : null,
        lastNMinutes: filterInputs.lastNMinutes
          ? parseInt(filterInputs.lastNMinutes, 10)
          : null,
        startDate: filterInputs.startDate || null,
        endDate: filterInputs.endDate || null,
        minCrossTierGap: filterInputs.minCrossTierGap
          ? parseInt(filterInputs.minCrossTierGap, 10)
          : null,
        maxCrossTierGap: filterInputs.maxCrossTierGap
          ? parseInt(filterInputs.maxCrossTierGap, 10)
          : null,
      }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [filterInputs]);

  // Save presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("explorer-filter-presets", JSON.stringify(savedPresets));
    } catch {
      // Ignore storage errors
    }
  }, [savedPresets]);

  // Handle sort click
  const handleSortClick = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  // Jump to nonce
  const handleJumpToNonce = useCallback(() => {
    const targetNonce = parseInt(jumpToNonce, 10);
    if (isNaN(targetNonce)) return;

    const index = sortedRows.findIndex((r) => r.nonce === targetNonce);
    if (index >= 0) {
      virtuosoRef.current?.scrollToIndex({ index, behavior: "smooth", align: "center" });
    }
    setJumpToNonce("");
  }, [jumpToNonce, sortedRows]);

  // Toggle filter section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Update non-text filters directly
  const updateFilter = useCallback(<K extends keyof ExplorerFilters>(
    key: K,
    value: ExplorerFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setFilterInputs({
      minMultiplier: "",
      maxMultiplier: "",
      minNonce: "",
      maxNonce: "",
      minTierGap: "",
      maxTierGap: "",
      minDeltaPrev: "",
      maxDeltaPrev: "",
      lastNMinutes: "",
      startDate: "",
      endDate: "",
      minCrossTierGap: "",
      maxCrossTierGap: "",
    });
  }, []);

  // Save current filters as preset
  const savePreset = useCallback(() => {
    if (!presetName.trim()) return;
    setSavedPresets((prev) => ({
      ...prev,
      [presetName.trim()]: { ...filters },
    }));
    setPresetName("");
  }, [presetName, filters]);

  // Load a preset
  const loadPreset = useCallback((name: string) => {
    const preset = savedPresets[name];
    if (!preset) return;
    setFilters({ ...preset });
    // Sync text inputs
    setFilterInputs({
      minMultiplier: preset.minMultiplier?.toString() ?? "",
      maxMultiplier: preset.maxMultiplier?.toString() ?? "",
      minNonce: preset.minNonce?.toString() ?? "",
      maxNonce: preset.maxNonce?.toString() ?? "",
      minTierGap: preset.minTierGap?.toString() ?? "",
      maxTierGap: preset.maxTierGap?.toString() ?? "",
      minDeltaPrev: preset.minDeltaPrev?.toString() ?? "",
      maxDeltaPrev: preset.maxDeltaPrev?.toString() ?? "",
      lastNMinutes: preset.lastNMinutes?.toString() ?? "",
      startDate: preset.startDate ?? "",
      endDate: preset.endDate ?? "",
      minCrossTierGap: preset.minCrossTierGap?.toString() ?? "",
      maxCrossTierGap: preset.maxCrossTierGap?.toString() ?? "",
    });
  }, [savedPresets]);

  // Delete a preset
  const deletePreset = useCallback((name: string) => {
    setSavedPresets((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  // Quick filter presets (built-in)
  const applyQuickPreset = useCallback((preset: string) => {
    switch (preset) {
      case ">=34":
        setFilterInputs((prev) => ({ ...prev, minMultiplier: "34" }));
        break;
      case "tier-hits":
        setFilterInputs((prev) => ({ ...prev, minMultiplier: String(tierThreshold) }));
        break;
      case "quick-hits":
        clearAllFilters();
        setFilters((prev) => ({
          ...prev,
          minMultiplier: tierThreshold,
          quickHitsOnly: true,
        }));
        setFilterInputs((prev) => ({ ...prev, minMultiplier: String(tierThreshold) }));
        break;
      case "overdue":
        clearAllFilters();
        setFilters((prev) => ({
          ...prev,
          minMultiplier: tierThreshold,
          overdueHitsOnly: true,
        }));
        setFilterInputs((prev) => ({ ...prev, minMultiplier: String(tierThreshold) }));
        break;
      case "on-cadence":
        clearAllFilters();
        setFilters((prev) => ({
          ...prev,
          minMultiplier: tierThreshold,
          gapDeviation: "tight",
        }));
        setFilterInputs((prev) => ({ ...prev, minMultiplier: String(tierThreshold) }));
        break;
      case "outliers":
        clearAllFilters();
        setFilters((prev) => ({
          ...prev,
          minMultiplier: tierThreshold,
          gapDeviation: "outlier",
        }));
        setFilterInputs((prev) => ({ ...prev, minMultiplier: String(tierThreshold) }));
        break;
      case "last-hour":
        clearAllFilters();
        setFilters((prev) => ({ ...prev, lastNMinutes: 60 }));
        setFilterInputs((prev) => ({ ...prev, lastNMinutes: "60" }));
        break;
      case "cross-tier-1066-164":
        clearAllFilters();
        setFilters((prev) => ({
          ...prev,
          minMultiplier: 1066.73,
          crossTierRef: "164+",
        }));
        setFilterInputs((prev) => ({ ...prev, minMultiplier: "1066.73" }));
        break;
      case "clear":
        clearAllFilters();
        break;
    }
  }, [tierThreshold, clearAllFilters]);

  // Sort icon
  const SortIcon = sortDir === "asc" ? IconSortAscending : IconSortDescending;

  // Column header with sort
  const SortableHeader = ({
    label,
    sortKeyName,
    className: headerClassName,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2 font-semibold transition-colors hover:text-foreground",
        sortKey === sortKeyName && "text-primary",
        headerClassName
      )}
      onClick={() => handleSortClick(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyName && <SortIcon size={12} />}
      </div>
    </th>
  );

  // Fixed header
  const fixedHeader = useMemo(
    () => (
      <tr className="border-b border-border/60">
        <SortableHeader label="Nonce" sortKeyName="nonce" className="w-[120px] text-left" />
        <SortableHeader
          label="Multi"
          sortKeyName="round_result"
          className="w-[100px] text-right"
        />
        <SortableHeader label="Δprev" sortKeyName="deltaPrev" className="w-[80px] text-right" />
        <SortableHeader
          label={`Gap (${TIER_OPTIONS.find((t) => t.id === selectedTier)?.label})`}
          sortKeyName="tierGap"
          className="w-[100px] text-right"
        />
        {filters.crossTierRef && (
          <th className="px-3 py-2 w-[110px] text-right font-semibold text-cyan-400">
            →{filters.crossTierRef}
          </th>
        )}
        <th className="px-3 py-2 w-[80px] text-right font-semibold">Bucket</th>
        {mode === "bets" && (
          <>
            <th className="px-3 py-2 w-[100px] text-right font-semibold">Amount</th>
            <th className="px-3 py-2 w-[100px] text-right font-semibold">Payout</th>
          </>
        )}
      </tr>
    ),
    [sortKey, sortDir, selectedTier, mode, handleSortClick, filters.crossTierRef]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-8",
          className
        )}
      >
        <p className="text-sm text-destructive">Failed to load data</p>
        <p className="text-xs text-destructive/70">{error.message}</p>
        <Button onClick={refresh} variant="destructive" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col gap-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-card/40 px-4 py-3">
        {/* Left: Mode toggle + Tier selector */}
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 p-1">
            <button
              type="button"
              onClick={() => setMode("rounds")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                mode === "rounds"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconTable size={14} />
              Rounds
            </button>
            <button
              type="button"
              onClick={() => setMode("bets")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                mode === "bets"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconList size={14} />
              Bets
            </button>
          </div>

          {/* Tier selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
                Tier: {TIER_OPTIONS.find((t) => t.id === selectedTier)?.label}
                <IconChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Tier Gap Context
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TIER_OPTIONS.map((tier) => (
                <DropdownMenuItem
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={cn(
                    "text-xs",
                    selectedTier === tier.id && "bg-primary/10 text-primary"
                  )}
                >
                  {tier.label} (exp: ~{PUMP_EXPERT_TIERS[tier.id].expectedGap})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Middle: Stats */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-cyan-500" : "bg-amber-500 animate-pulse"
              )}
            />
            {isConnected ? "Live" : "Reconnecting"}
          </span>
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-mono text-foreground/80">
            {sortedRows.length.toLocaleString()} rows
            {sortedRows.length !== totalCount && ` / ${totalCount.toLocaleString()}`}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Jump to nonce */}
          <div className="flex items-center gap-1">
            <Input
              placeholder="Jump to #"
              value={jumpToNonce}
              onChange={(e) => setJumpToNonce(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleJumpToNonce()}
              className="h-8 w-24 text-xs font-mono"
            />
          </div>

          {/* Filter toggle */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-2 text-xs",
              showFilters && "bg-primary/10 text-primary",
              filtersActive && !showFilters && "border-primary/50"
            )}
            onClick={() => setShowFilters((p) => !p)}
          >
            <IconFilter size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={refresh}>
            <IconRefresh size={14} />
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-white/5 bg-card/40 overflow-hidden">
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-background/30 px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-2">
              Quick:
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset(">=34")}>
              ≥34×
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("tier-hits")}>
              <IconTarget size={12} />
              Tier Hits
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("on-cadence")}>
              <IconChartBar size={12} />
              On Cadence
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("quick-hits")}>
              <IconBolt size={12} />
              Quick Hits
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("overdue")}>
              <IconAlertTriangle size={12} />
              Overdue
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("outliers")}>
              Outliers
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("last-hour")}>
              <IconClock size={12} />
              Last Hour
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => applyQuickPreset("cross-tier-1066-164")}>
              <IconArrowsExchange size={12} />
              1066→164 Gap
            </Button>
            <div className="flex-1" />
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => applyQuickPreset("clear")}
              >
                <IconFilterOff size={12} />
                Clear All
              </Button>
            )}
          </div>

          {/* Filter Sections */}
          <div className="grid gap-0 md:grid-cols-2 lg:grid-cols-3">
            {/* Basic Filters */}
            <FilterSection
              title="Basic Filters"
              icon={<IconFilter size={14} />}
              expanded={expandedSections.basic}
              onToggle={() => toggleSection("basic")}
            >
              <div className="grid grid-cols-2 gap-3">
                <FilterInput
                  label="Min Multi"
                  value={filterInputs.minMultiplier}
                  onChange={(v) => setFilterInputs((p) => ({ ...p, minMultiplier: v }))}
                  placeholder="0"
                />
                <FilterInput
                  label="Max Multi"
                  value={filterInputs.maxMultiplier}
                  onChange={(v) => setFilterInputs((p) => ({ ...p, maxMultiplier: v }))}
                  placeholder="∞"
                />
                <FilterInput
                  label="Min Nonce"
                  value={filterInputs.minNonce}
                  onChange={(v) => setFilterInputs((p) => ({ ...p, minNonce: v }))}
                  placeholder="0"
                />
                <FilterInput
                  label="Max Nonce"
                  value={filterInputs.maxNonce}
                  onChange={(v) => setFilterInputs((p) => ({ ...p, maxNonce: v }))}
                  placeholder="∞"
                />
              </div>
            </FilterSection>

            {/* Tier Filters */}
            <FilterSection
              title="Tier Filters"
              icon={<IconTarget size={14} />}
              expanded={expandedSections.tier}
              onToggle={() => toggleSection("tier")}
            >
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Tier Bucket
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {(['all', '<34', '34+', '164+', '400+', '1066+', '3200+', '11200+'] as TierBucket[]).map((bucket) => (
                      <button
                        key={bucket}
                        type="button"
                        onClick={() => updateFilter("tierBucket", bucket)}
                        className={cn(
                          "rounded-md px-2 py-1 text-[10px] font-medium transition",
                          filters.tierBucket === bucket
                            ? "bg-primary/20 text-primary"
                            : "bg-background/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {bucket}
                      </button>
                    ))}
                  </div>
                </div>
                <FilterToggle
                  label="Exact tier match only"
                  checked={filters.exactTierMatch}
                  onCheckedChange={(v) => updateFilter("exactTierMatch", v)}
                />
              </div>
            </FilterSection>

            {/* Gap Filters */}
            <FilterSection
              title="Gap & Delta Filters"
              icon={<IconChartBar size={14} />}
              expanded={expandedSections.gap}
              onToggle={() => toggleSection("gap")}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FilterInput
                    label="Min Gap"
                    value={filterInputs.minTierGap}
                    onChange={(v) => setFilterInputs((p) => ({ ...p, minTierGap: v }))}
                    placeholder="0"
                  />
                  <FilterInput
                    label="Max Gap"
                    value={filterInputs.maxTierGap}
                    onChange={(v) => setFilterInputs((p) => ({ ...p, maxTierGap: v }))}
                    placeholder="∞"
                  />
                  <FilterInput
                    label="Min Δprev"
                    value={filterInputs.minDeltaPrev}
                    onChange={(v) => setFilterInputs((p) => ({ ...p, minDeltaPrev: v }))}
                    placeholder="0"
                  />
                  <FilterInput
                    label="Max Δprev"
                    value={filterInputs.maxDeltaPrev}
                    onChange={(v) => setFilterInputs((p) => ({ ...p, maxDeltaPrev: v }))}
                    placeholder="∞"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Gap Deviation
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {(['any', 'tight', 'normal', 'loose', 'outlier'] as GapDeviationBand[]).map((band) => (
                      <button
                        key={band}
                        type="button"
                        onClick={() => updateFilter("gapDeviation", band)}
                        className={cn(
                          "rounded-md px-2 py-1 text-[10px] font-medium transition capitalize",
                          filters.gapDeviation === band
                            ? "bg-primary/20 text-primary"
                            : "bg-background/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {band === "any" ? "Any" : band === "tight" ? "±20%" : band === "normal" ? "±40%" : band === "loose" ? "±60%" : ">60%"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterSection>

            {/* Time Filters */}
            <FilterSection
              title="Time Filters"
              icon={<IconClock size={14} />}
              expanded={expandedSections.time}
              onToggle={() => toggleSection("time")}
            >
              <div className="space-y-3">
                <FilterInput
                  label="Last N minutes"
                  value={filterInputs.lastNMinutes}
                  onChange={(v) => setFilterInputs((p) => ({ ...p, lastNMinutes: v }))}
                  placeholder="e.g. 60"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Start Date
                    </Label>
                    <Input
                      type="datetime-local"
                      value={filterInputs.startDate}
                      onChange={(e) => setFilterInputs((p) => ({ ...p, startDate: e.target.value }))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      End Date
                    </Label>
                    <Input
                      type="datetime-local"
                      value={filterInputs.endDate}
                      onChange={(e) => setFilterInputs((p) => ({ ...p, endDate: e.target.value }))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </FilterSection>

            {/* Pattern Filters */}
            <FilterSection
              title="Pattern Filters"
              icon={<IconPlayerPlay size={14} />}
              expanded={expandedSections.pattern}
              onToggle={() => toggleSection("pattern")}
            >
              <div className="space-y-2">
                <FilterToggle
                  label="First hit only (gap reset)"
                  checked={filters.firstHitOnly}
                  onCheckedChange={(v) => updateFilter("firstHitOnly", v)}
                />
                <FilterToggle
                  label={`Quick hits only (gap < ${Math.round(expectedGap / 2)})`}
                  checked={filters.quickHitsOnly}
                  onCheckedChange={(v) => updateFilter("quickHitsOnly", v)}
                />
                <FilterToggle
                  label={`Overdue hits only (gap > ${Math.round(expectedGap * 1.5)})`}
                  checked={filters.overdueHitsOnly}
                  onCheckedChange={(v) => updateFilter("overdueHitsOnly", v)}
                />
              </div>
            </FilterSection>

            {/* Cross-Tier Analysis */}
            <FilterSection
              title="Cross-Tier Analysis"
              icon={<IconArrowsExchange size={14} />}
              expanded={expandedSections.crossTier}
              onToggle={() => toggleSection("crossTier")}
            >
              <div className="space-y-3">
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[10px] text-cyan-300/80">
                  <strong>Purpose:</strong> Measure gap from each {TIER_OPTIONS.find(t => t.id === selectedTier)?.label ?? "tier"} hit 
                  to the preceding reference tier hit. Useful for analyzing cross-tier cadence patterns.
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Reference Tier (gap measured from)
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => updateFilter("crossTierRef", null)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] font-medium transition",
                        filters.crossTierRef === null
                          ? "bg-muted text-muted-foreground"
                          : "bg-background/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Off
                    </button>
                    {(['164+', '400+', '1066+', '3200+'] as TierBucket[]).map((bucket) => (
                      <button
                        key={bucket}
                        type="button"
                        onClick={() => updateFilter("crossTierRef", bucket)}
                        className={cn(
                          "rounded-md px-2 py-1 text-[10px] font-medium transition",
                          filters.crossTierRef === bucket
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "bg-background/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {bucket}
                      </button>
                    ))}
                  </div>
                </div>
                {filters.crossTierRef && (
                  <div className="grid grid-cols-2 gap-3">
                    <FilterInput
                      label="Min Cross-Gap"
                      value={filterInputs.minCrossTierGap}
                      onChange={(v) => setFilterInputs((p) => ({ ...p, minCrossTierGap: v }))}
                      placeholder="0"
                    />
                    <FilterInput
                      label="Max Cross-Gap"
                      value={filterInputs.maxCrossTierGap}
                      onChange={(v) => setFilterInputs((p) => ({ ...p, maxCrossTierGap: v }))}
                      placeholder="∞"
                    />
                  </div>
                )}
              </div>
            </FilterSection>

            {/* Saved Presets */}
            <FilterSection
              title="Saved Presets"
              icon={<IconDeviceFloppy size={14} />}
              expanded={expandedSections.presets}
              onToggle={() => toggleSection("presets")}
            >
              <div className="space-y-3">
                {/* Save new preset */}
                <div className="flex gap-2">
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="h-8 flex-1 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={savePreset}
                    disabled={!presetName.trim() || !filtersActive}
                  >
                    Save
                  </Button>
                </div>
                {/* List saved presets */}
                {Object.keys(savedPresets).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(savedPresets).map((name) => (
                      <div
                        key={name}
                        className="group flex items-center gap-1 rounded-md bg-background/60 pl-2 pr-1 py-1 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => loadPreset(name)}
                          className="text-foreground/80 hover:text-foreground transition"
                        >
                          {name}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(name)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition p-0.5"
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(savedPresets).length === 0 && (
                  <p className="text-[10px] text-muted-foreground/60">
                    No saved presets yet. Configure filters and save.
                  </p>
                )}
              </div>
            </FilterSection>
          </div>
        </div>
      )}

      {/* Table */}
      {/* Virtuoso needs a real height (not just min-height) for reliable rendering; use a viewport-based height like LiveBetsTable does. */}
      <div
        className="relative overflow-hidden rounded-xl border border-white/5 bg-card/40"
        style={{ height: "calc(100vh - 360px)", minHeight: 520 }}
      >
        <TableVirtuoso
          ref={virtuosoRef}
          data={sortedRows}
          components={tableComponents}
          fixedHeaderContent={() => fixedHeader}
          totalCount={sortedRows.length}
          style={{ height: "100%" }}
          itemContent={(index, row) => {
            const isTierHit = row.round_result >= tierThreshold;
            const bucket = getBucketLabel(row.round_result);

            return (
              <>
                <td className="px-3 py-2 font-mono text-foreground tabular-nums">
                  {row.nonce.toLocaleString()}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono font-semibold tabular-nums",
                    getMultiplierColor(row.round_result)
                  )}
                >
                  {row.round_result.toFixed(2)}×
                </td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground tabular-nums">
                  {row.deltaPrev !== null ? row.deltaPrev.toLocaleString() : "—"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono tabular-nums",
                    isTierHit
                      ? getTierGapColor(row.tierGap, expectedGap)
                      : "text-muted-foreground/30"
                  )}
                >
                  {isTierHit
                    ? row.tierGap !== null
                      ? row.tierGap.toLocaleString()
                      : "—"
                    : "·"}
                </td>
                {filters.crossTierRef && (
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      isTierHit && row.crossTierGap !== null
                        ? "text-cyan-400 font-semibold"
                        : "text-muted-foreground/30"
                    )}
                  >
                    {isTierHit
                      ? row.crossTierGap !== null
                        ? row.crossTierGap.toLocaleString()
                        : "—"
                      : "·"}
                  </td>
                )}
                <td className="px-3 py-2 text-right text-[10px] uppercase text-muted-foreground">
                  {bucket}
                </td>
                {mode === "bets" && "amount" in row && (
                  <>
                    <td className="px-3 py-2 text-right font-mono text-foreground/80 tabular-nums">
                      {(row as any).amount?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-foreground/80 tabular-nums">
                      {(row as any).payout?.toFixed(2) ?? "—"}
                    </td>
                  </>
                )}
              </>
            );
          }}
        />

        {sortedRows.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-white/10 bg-card/70 p-6 text-center backdrop-blur-md">
              <div className="text-sm text-muted-foreground">
                {rows.length === 0 ? "Waiting for data..." : "No rows match filters"}
              </div>
              {mode === "rounds" && rows.length === 0 && (
                <div className="mt-3 text-xs text-muted-foreground/80">
                  Rounds mode requires heartbeat ingest. Ensure your sender posts
                  {" "}
                  <span className="font-mono text-foreground/80">type:\"heartbeat\"</span>
                  {" "}
                  messages to <span className="font-mono text-foreground/80">POST /live/ingest</span>.
                  You can switch to <span className="font-medium text-foreground/80">Bets</span> to view the hit tape even without heartbeats.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cross-Tier Statistics Summary */}
      {crossTierStats && crossTierStats.count > 0 && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconMathAvg size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Cross-Tier Gap Statistics
            </h3>
            <span className="text-xs text-muted-foreground">
              ({TIER_OPTIONS.find(t => t.id === selectedTier)?.label} → {filters.crossTierRef})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <StatItem label="Count" value={crossTierStats.count.toLocaleString()} />
            <StatItem 
              label="Average" 
              value={crossTierStats.avg !== null ? crossTierStats.avg.toFixed(1) : "—"} 
              highlight 
            />
            <StatItem 
              label="Median" 
              value={crossTierStats.median !== null ? crossTierStats.median.toFixed(1) : "—"} 
            />
            <StatItem 
              label="Min" 
              value={crossTierStats.min !== null ? crossTierStats.min.toLocaleString() : "—"} 
            />
            <StatItem 
              label="Max" 
              value={crossTierStats.max !== null ? crossTierStats.max.toLocaleString() : "—"} 
            />
            <StatItem 
              label="Std Dev" 
              value={crossTierStats.stdDev !== null ? crossTierStats.stdDev.toFixed(1) : "—"} 
            />
          </div>
          {filters.minNonce !== null || filters.maxNonce !== null ? (
            <div className="mt-3 text-[10px] text-muted-foreground border-t border-white/5 pt-2">
              <span className="font-medium">Nonce Range:</span>{" "}
              {filters.minNonce?.toLocaleString() ?? "start"} → {filters.maxNonce?.toLocaleString() ?? "end"}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============ Helpers ============

function getBucketLabel(roundResult: number): string {
  if (roundResult >= 11200.65) return "11200+";
  if (roundResult >= 3200.18) return "3200+";
  if (roundResult >= 1066.73) return "1066+";
  if (roundResult >= 400.02) return "400+";
  if (roundResult >= 164.72) return "164+";
  if (roundResult >= 34) return "34+";
  return "<34";
}

// ============ Filter Panel Helper Components ============

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, icon, expanded, onToggle, children }: FilterSectionProps) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle} className="border-b border-r border-white/5 last:border-r-0">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-white/[0.02]">
        <span className={cn("transition-transform", expanded && "rotate-90")}>
          <IconChevronRight size={12} />
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface FilterInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}

function FilterInput({ label, value, onChange, placeholder, type = "text" }: FilterInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.-]/g, ""))}
        className="h-8 text-xs font-mono"
        placeholder={placeholder}
      />
    </div>
  );
}

interface FilterToggleProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function FilterToggle({ label, checked, onCheckedChange }: FilterToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-foreground/80 cursor-pointer" onClick={() => onCheckedChange(!checked)}>
        {label}
      </Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function StatItem({ label, value, highlight }: StatItemProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn(
        "font-mono text-lg tabular-nums",
        highlight ? "text-cyan-400 font-semibold" : "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

export const LiveExplorerTable = memo(LiveExplorerTableComponent);

