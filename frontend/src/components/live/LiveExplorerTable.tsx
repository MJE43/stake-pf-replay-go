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
  IconRefresh,
  IconTable,
  IconList,
  IconChevronDown,
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
  sortRows,
  type ExplorerMode,
  type ExplorerFilters,
  type ExplorerRow,
  type DerivedRow,
  type SortKey,
  type SortDir,
} from "@/hooks/useExplorerData";
import { PUMP_EXPERT_TIERS, TIER_ORDER, type TierId } from "@/lib/pump-tiers";

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
  const [filters, setFilters] = useState<ExplorerFilters>({
    minMultiplier: null,
    maxMultiplier: null,
    minNonce: null,
    maxNonce: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [jumpToNonce, setJumpToNonce] = useState("");

  // Filter input state (debounced)
  const [filterInputs, setFilterInputs] = useState({
    minMultiplier: "",
    maxMultiplier: "",
    minNonce: "",
    maxNonce: "",
  });

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

  // Apply filters
  const filteredRows = useMemo(() => {
    return applyFilters(rows, filters);
  }, [rows, filters]);

  // Compute derived columns
  const derivedRows = useMemo(() => {
    return computeDerivedColumns(filteredRows, tierThreshold);
  }, [filteredRows, tierThreshold]);

  // Sort rows
  const sortedRows = useMemo(() => {
    return sortRows(derivedRows, sortKey, sortDir);
  }, [derivedRows, sortKey, sortDir]);

  // Debounce filter inputs
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters({
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
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [filterInputs]);

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

  // Quick filter presets
  const applyPreset = useCallback((preset: string) => {
    switch (preset) {
      case ">=34":
        setFilterInputs((prev) => ({ ...prev, minMultiplier: "34" }));
        break;
      case "tier-hits":
        setFilterInputs((prev) => ({ ...prev, minMultiplier: String(tierThreshold) }));
        break;
      case "clear":
        setFilterInputs({ minMultiplier: "", maxMultiplier: "", minNonce: "", maxNonce: "" });
        break;
    }
  }, [tierThreshold]);

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
        <th className="px-3 py-2 w-[80px] text-right font-semibold">Bucket</th>
        {mode === "bets" && (
          <>
            <th className="px-3 py-2 w-[100px] text-right font-semibold">Amount</th>
            <th className="px-3 py-2 w-[100px] text-right font-semibold">Payout</th>
          </>
        )}
      </tr>
    ),
    [sortKey, sortDir, selectedTier, mode, handleSortClick]
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
            className={cn("h-8 gap-2 text-xs", showFilters && "bg-primary/10 text-primary")}
            onClick={() => setShowFilters((p) => !p)}
          >
            <IconFilter size={14} />
            Filter
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={refresh}>
            <IconRefresh size={14} />
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/5 bg-card/40 px-4 py-3">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Min Multi
            </Label>
            <Input
              value={filterInputs.minMultiplier}
              onChange={(e) =>
                setFilterInputs((p) => ({ ...p, minMultiplier: e.target.value }))
              }
              className="h-8 w-24 text-xs font-mono"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Max Multi
            </Label>
            <Input
              value={filterInputs.maxMultiplier}
              onChange={(e) =>
                setFilterInputs((p) => ({ ...p, maxMultiplier: e.target.value }))
              }
              className="h-8 w-24 text-xs font-mono"
              placeholder="∞"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Min Nonce
            </Label>
            <Input
              value={filterInputs.minNonce}
              onChange={(e) =>
                setFilterInputs((p) => ({ ...p, minNonce: e.target.value }))
              }
              className="h-8 w-24 text-xs font-mono"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Max Nonce
            </Label>
            <Input
              value={filterInputs.maxNonce}
              onChange={(e) =>
                setFilterInputs((p) => ({ ...p, maxNonce: e.target.value }))
              }
              className="h-8 w-24 text-xs font-mono"
              placeholder="∞"
            />
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => applyPreset(">=34")}
            >
              ≥34×
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => applyPreset("tier-hits")}
            >
              Tier hits only
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => applyPreset("clear")}
            >
              Clear
            </Button>
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

export const LiveExplorerTable = memo(LiveExplorerTableComponent);

