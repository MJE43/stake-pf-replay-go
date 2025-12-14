/**
 * LiveStreamDetail
 *
 * Pump cadence strategy dashboard.
 * Purpose-built to support the "1066+ every ~1000 nonces ±200-400" heuristic.
 */

import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconBroadcast,
  IconCheck,
  IconCopy,
  IconDownload,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconLayoutDashboard,
  IconTableOptions,
} from '@tabler/icons-react';
import { DeleteStream, ExportCSV } from '@wails/go/livehttp/LiveModule';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useCadenceStream } from '@/hooks/useCadenceStream';
import { TIER_ORDER, TierId } from '@/lib/pump-tiers';
import {
  SeedQualityPanel,
  TierCadenceCard,
  LiveStreamTape,
  DecisionSignals,
  PatternVisualizer,
  LiveExplorerTable,
} from '@/components/live';

function CopyButton({ value, size = 14 }: { value: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <IconCheck size={size} className="text-cyan-400" /> : <IconCopy size={size} />}
    </button>
  );
}

export default function LiveStreamDetailPage(props: { streamId?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const streamId = props.streamId ?? params.id!;

  const {
    currentNonce,
    tierStats,
    seedQuality,
    signals,
    recentRounds,
    bets,
    totalBets,
    isConnected,
    isLoading,
    error,
    stream,
    refresh,
  } = useCadenceStream({
    streamId,
    initialRoundsLimit: 10000,
    betThreshold: 34,
  });

  const onExportCsv = useCallback(async () => {
    try {
      const exported = await ExportCSV(streamId);
      if (exported.includes('\n') || exported.includes(',')) {
        const blob = new Blob([exported], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `stream-${streamId}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        toast.success('CSV downloaded');
      } else {
        toast.success(`CSV written to ${exported}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to export CSV');
    }
  }, [streamId]);

  const onDeleteStream = useCallback(async () => {
    if (!window.confirm('Delete this stream and all associated data?')) return;
    try {
      await DeleteStream(streamId);
      toast.success('Stream removed');
      navigate('/live');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [streamId, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit gap-2" onClick={() => navigate('/live')}>
          <IconArrowLeft size={16} /> Back
        </Button>
        <div className="max-w-md border border-destructive/50 bg-destructive/10 p-6 rounded-xl">
          <h2 className="font-display text-lg uppercase tracking-wider text-destructive">Error</h2>
          <p className="mt-2 text-sm text-destructive/80">{error.message}</p>
          <Button onClick={refresh} variant="destructive" size="sm" className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/live')}>
            <IconArrowLeft size={18} />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <IconBroadcast size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg uppercase tracking-wider text-foreground">
                  Pump Cadence
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <code className="font-mono text-[10px]">{streamId.slice(0, 8)}</code>
                <CopyButton value={streamId} size={12} />
                {stream && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{stream.clientSeed.slice(0, 12)}...</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Decision signals (compact) */}
          <DecisionSignals signals={signals} className="hidden md:flex" />

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={refresh}
          >
            <IconRefresh size={16} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <IconSettings size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportCsv}>
                <IconDownload size={14} className="mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDeleteStream} className="text-destructive focus:text-destructive">
                <IconTrash size={14} className="mr-2" /> Delete Stream
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs: Dashboard | Explorer */}
      <Tabs defaultValue="dashboard" className="flex flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="dashboard" className="gap-2">
            <IconLayoutDashboard size={14} />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="explorer" className="gap-2">
            <IconTableOptions size={14} />
            Explorer
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="flex-1 space-y-6 mt-4">
          {/* Seed Quality Panel */}
          <SeedQualityPanel
            quality={seedQuality}
            currentNonce={currentNonce}
            isConnected={isConnected}
          />

          {/* Decision Signals (mobile) */}
          <div className="md:hidden">
            <DecisionSignals signals={signals} />
          </div>

          {/* Pattern Visualizer */}
          <PatternVisualizer rounds={recentRounds} maxBars={200} />

          {/* Main Dashboard Grid */}
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            {/* Left Column - Tier Cards */}
            <div className="flex flex-col gap-4">
              {/* Primary Tiers (1066, 3200, 11200) */}
              <div className="grid gap-4 sm:grid-cols-3">
                {(['T1066', 'T3200', 'T11200'] as TierId[]).map((tierId) => {
                  const stats = tierStats.get(tierId);
                  if (!stats) return <Skeleton key={tierId} className="h-[280px]" />;
                  return <TierCadenceCard key={tierId} stats={stats} />;
                })}
              </div>

              {/* Secondary Tiers (164, 400) - smaller */}
              <div className="grid gap-4 sm:grid-cols-2">
                {(['T164', 'T400'] as TierId[]).map((tierId) => {
                  const stats = tierStats.get(tierId);
                  if (!stats) return <Skeleton key={tierId} className="h-[200px]" />;
                  return <TierCadenceCard key={tierId} stats={stats} />;
                })}
              </div>
            </div>

            {/* Right Column - Stream Tape */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <LiveStreamTape bets={bets} maxItems={100} className="max-h-[calc(100vh-200px)]" />
            </div>
          </div>

          {/* Stream Info Footer */}
          {stream && (
            <div className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-md p-4">
              <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Server Seed Hash" value={stream.serverSeedHashed} copyable />
                <InfoItem label="Client Seed" value={stream.clientSeed} copyable />
                <InfoItem label="Created" value={formatDateTime(stream.createdAt)} />
                <InfoItem label="Last Activity" value={formatDateTime(stream.lastSeenAt)} />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Explorer Tab */}
        <TabsContent value="explorer" className="flex-1 mt-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          <LiveExplorerTable streamId={streamId} className="h-full" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoItem({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <code className="truncate font-mono text-foreground">{value}</code>
        {copyable && <CopyButton value={value} size={12} />}
      </div>
    </div>
  );
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return '—';
  }
}
