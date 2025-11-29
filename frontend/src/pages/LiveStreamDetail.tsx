import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconCopy, IconCheck, IconSettings, IconDownload, IconTrash, IconTarget, IconBroadcast } from '@tabler/icons-react';
import { EventsOn } from '@wails/runtime/runtime';
import { GetStream, UpdateNotes, DeleteStream, ExportCSV, IngestInfo } from '@wails/go/livehttp/LiveModule';
import { livestore } from '@wails/go/models';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBetsStream } from '@/hooks/useBetsStream';
import { MultiplierStream, GapAnalysis, RecentHits } from '@/components/MultiplierAnalysis';
import { cn } from '@/lib/utils';
import type { LiveBet } from '@/types/live';

function normalizeStream(s: livestore.LiveStream) {
  const idStr = Array.isArray(s.id) ? s.id.join('-') : String(s.id);
  return {
    id: idStr,
    server_seed_hashed: s.server_seed_hashed ?? '',
    client_seed: s.client_seed ?? '',
    created_at: s.created_at ? new Date(s.created_at).toISOString() : '',
    last_seen_at: s.last_seen_at ? new Date(s.last_seen_at).toISOString() : '',
    notes: s.notes ?? '',
    total_bets: s.total_bets ?? 0,
    highest_round_result: s.highest_result ?? undefined,
  };
}

type StreamDetail = ReturnType<typeof normalizeStream>;

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
      className="rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors"
    >
      {copied ? <IconCheck size={size} className="text-emerald-400" /> : <IconCopy size={size} />}
    </button>
  );
}

// Compact live bets ticker showing just the multiplier stream
function LiveMultiplierTicker({ bets, targetMultiplier }: { bets: LiveBet[]; targetMultiplier: number }) {
  const recentBets = useMemo(() => {
    return [...bets].sort((a, b) => b.nonce - a.nonce).slice(0, 50);
  }, [bets]);

  return (
    <div className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-md overflow-hidden">
      <div className="border-b border-white/5 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">Live Feed</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{recentBets.length} recent</span>
      </div>
      <div className="p-3 flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
        {recentBets.map((bet) => {
          const isHit = bet.round_result >= targetMultiplier;
          return (
            <div
              key={bet.id}
              className={cn(
                "px-2 py-1 rounded text-xs font-mono font-medium transition-all",
                isHit 
                  ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" 
                  : "bg-white/5 text-muted-foreground"
              )}
              title={`Nonce #${bet.nonce}`}
            >
              {bet.round_result.toFixed(2)}×
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LiveStreamDetailPage(props: { streamId?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const streamId = props.streamId ?? params.id!;
  const [detail, setDetail] = useState<StreamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState<string>('');
  const [targetMultiplier, setTargetMultiplier] = useState(10);
  const [targetInput, setTargetInput] = useState('10');

  const load = useCallback(async (attempt = 0) => {
    let scheduledRetry = false;
    setLoading(true);
    setError(null);

    try {
      const stream = await GetStream(streamId);
      setDetail(normalizeStream(stream));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load stream';
      if (message.includes('not found') && attempt < 3) {
        scheduledRetry = true;
        setTimeout(() => load(attempt + 1), 1000);
      } else {
        setError(message);
        toast.error(message);
      }
    } finally {
      if (!scheduledRetry) {
        setLoading(false);
      }
    }
  }, [streamId]);

  useEffect(() => {
    (async () => {
      try {
        const info = await IngestInfo();
        const url = new URL(info.url);
        setApiBase(`${url.protocol}//${url.host}`);
      } catch {
        setApiBase('');
      }
    })();
  }, []);

  useEffect(() => {
    setDetail(null);
    load();
    const off = EventsOn(`live:newrows:${streamId}`, () => load());
    return () => off();
  }, [streamId, load]);

  const { rows: bets, isStreaming } = useBetsStream({
    streamId,
    minMultiplier: 0,
    apiBase,
    pageSize: 500,
    pollMs: 1000,
    order: 'desc',
  });

  const handleTargetChange = useCallback(() => {
    const val = parseFloat(targetInput);
    if (!isNaN(val) && val > 0) {
      setTargetMultiplier(val);
    }
  }, [targetInput]);

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
    if (!window.confirm('Delete this stream and all associated bets?')) return;
    try {
      await DeleteStream(streamId);
      toast.success('Stream removed');
      navigate('/live');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [streamId, navigate]);

  if (loading && !detail) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[300px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Button variant="ghost" className="w-fit gap-2" onClick={() => navigate('/live')}>
          <IconArrowLeft size={16} /> Back
        </Button>
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 p-6">
          <h2 className="text-lg font-bold text-destructive">Error</h2>
          <p className="text-sm text-destructive/80 mt-2">{error}</p>
          <Button onClick={() => load()} variant="destructive" className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/live')}>
            <IconArrowLeft size={18} />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 text-primary ring-1 ring-primary/20">
              <IconBroadcast size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Live Analysis</h1>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  isStreaming ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                )}>
                  {isStreaming ? 'Connected' : 'Reconnecting...'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">{streamId.slice(0, 8)}</code>
                <CopyButton value={streamId} size={12} />
                <span>•</span>
                <span>{bets.length.toLocaleString()} bets loaded</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Target Multiplier Input */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
            <IconTarget size={14} className="text-amber-400" />
            <Label className="text-xs text-muted-foreground">Target:</Label>
            <Input
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={handleTargetChange}
              onKeyDown={(e) => e.key === 'Enter' && handleTargetChange()}
              className="h-6 w-16 border-0 bg-transparent p-0 text-center font-mono text-sm font-bold text-amber-400 focus-visible:ring-0"
            />
            <span className="text-xs text-muted-foreground">×</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-white/5">
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

      {/* Main Dashboard - Optimized for prediction */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left Column - Primary Analysis */}
        <div className="flex flex-col gap-4">
          {/* Multiplier Stream Chart - Most Important */}
          <MultiplierStream bets={bets} targetMultiplier={targetMultiplier} />
          
          {/* Live Ticker */}
          <LiveMultiplierTicker bets={bets} targetMultiplier={targetMultiplier} />
        </div>

        {/* Right Column - Prediction Tools */}
        <div className="flex flex-col gap-4">
          {/* Gap Analysis - Key for prediction */}
          <GapAnalysis bets={bets} targetMultiplier={targetMultiplier} />
          
          {/* Recent Hits */}
          <RecentHits bets={bets} targetMultiplier={targetMultiplier} />

          {/* Stream Info (collapsed) */}
          {detail && (
            <div className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-md p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-3">Stream Info</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Server Hash</span>
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-foreground/80 truncate max-w-[140px]">{detail.server_seed_hashed.slice(0, 12)}...</code>
                    <CopyButton value={detail.server_seed_hashed} size={12} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Client Seed</span>
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-foreground/80 truncate max-w-[140px]">{detail.client_seed}</code>
                    <CopyButton value={detail.client_seed} size={12} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Bets</span>
                  <span className="font-mono font-medium text-foreground">{detail.total_bets.toLocaleString()}</span>
                </div>
                {detail.highest_round_result && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Peak</span>
                    <span className="font-mono font-bold text-amber-400">{detail.highest_round_result.toFixed(2)}×</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
