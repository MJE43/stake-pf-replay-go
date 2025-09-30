import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconAlertCircle,
  IconArrowRight,
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { EventsOn } from '@wails/runtime/runtime';
import { ListStreams, DeleteStream, IngestInfo } from '@wails/go/livehttp/LiveModule';
import { livestore } from '@wails/go/models';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/useDebounce';

function normalizeStream(s: livestore.LiveStream) {
  const idStr = Array.isArray(s.id) ? s.id.join('-') : String(s.id);

  return {
    id: idStr,
    serverSeedHashed: s.server_seed_hashed ?? '',
    clientSeed: s.client_seed ?? '',
    createdAt: s.created_at ? new Date(s.created_at).toISOString() : '',
    lastSeenAt: s.last_seen_at ? new Date(s.last_seen_at).toISOString() : '',
    notes: s.notes ?? '',
    totalBets: s.total_bets ?? 0,
    highestRoundResult: s.highest_result ?? undefined,
  };
}

type Stream = ReturnType<typeof normalizeStream>;

export default function LiveStreamsListPage() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [autoFollow, setAutoFollow] = useState(false);
  const [apiBase, setApiBase] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'IngestInfo'], { timeoutMs: 10_000 });
        const info = await callWithRetry(() => IngestInfo(), 4, 250);
        try {
          const url = new URL(info.url);
          setApiBase(`${url.protocol}//${url.host}`);
        } catch {
          setApiBase('');
        }
      } catch (err) {
        console.warn('Failed to load ingest info', err);
        setApiBase('');
      }
    })();
  }, []);

  const load = async () => {
    try {
      setError(null);
      await waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'ListStreams'], { timeoutMs: 10_000 });
      const rows = await callWithRetry(() => ListStreams(200, 0), 4, 300);
      setStreams(rows.map(normalizeStream));
    } catch (e: any) {
      setError(e?.message || 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    for (const s of streams) {
      const off = EventsOn(`live:newrows:${s.id}`, () => load());
      unsubscribers.push(off);
    }
    return () => {
      unsubscribers.forEach((off) => off());
    };
  }, [streams]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const sorted = [...streams].sort((a, b) => {
      const ta = Date.parse(a.lastSeenAt || a.createdAt || '1970-01-01');
      const tb = Date.parse(b.lastSeenAt || b.createdAt || '1970-01-01');
      return tb - ta;
    });
    if (!q) return sorted;
    return sorted.filter((s) => {
      const hash = s.serverSeedHashed?.toLowerCase() ?? '';
      const client = s.clientSeed?.toLowerCase() ?? '';
      return hash.includes(q) || client.includes(q);
    });
  }, [streams, debouncedSearch]);

  const lastAutoFollowed = useRef<string | null>(null);
  useEffect(() => {
    if (!autoFollow || filtered.length === 0 || loading || error) return;
    const latest = filtered[0];
    if (latest?.id && latest.id !== lastAutoFollowed.current && latest.totalBets > 0) {
      lastAutoFollowed.current = latest.id;
      window.setTimeout(() => navigate(`/live/${latest.id}`), 120);
    }
  }, [autoFollow, filtered, navigate, loading, error]);

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this stream and all associated bets?')) return;
    try {
      await waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'DeleteStream'], { timeoutMs: 10_000 });
      await callWithRetry(() => DeleteStream(id), 3, 250);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete stream');
    }
  };

  const openStream = (id: string) => navigate(`/live/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
          <Badge className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
            {streams.length}
          </Badge>
          <h1 className="text-xl font-semibold text-foreground">Live Streams</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitor active Stake Originals sessions and jump into their live bet feeds.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-none border border-border bg-card p-4 shadow-[var(--shadow-sm)] md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by server hash or client seed"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={autoFollow} onCheckedChange={setAutoFollow} />
            Auto-follow latest
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={load} className="border-border">
                  <IconRefresh size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh now</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" icon={<IconAlertCircle size={18} />} title="Live streams unavailable">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-none border border-border bg-card p-8 shadow-[var(--shadow-sm)]">
          <IconLoader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
          <span className="text-sm text-muted-foreground">Loading streams...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-none border border-border bg-card p-12 text-center shadow-[var(--shadow-sm)]">
          <span className="text-lg font-semibold text-foreground">No streams yet</span>
          <span className="text-sm text-muted-foreground">
            Point Antebot to the ingest URL and start betting to populate this list.
          </span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              apiBase={apiBase}
              onDelete={onDelete}
              onOpen={openStream}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StreamCard({
  stream,
  apiBase,
  onDelete,
  onOpen,
}: {
  stream: Stream;
  apiBase: string;
  onDelete: (id: string) => Promise<void> | void;
  onOpen: (id: string) => void;
}) {
  const lastSeen = stream.lastSeenAt ? new Date(stream.lastSeenAt).toLocaleString() : '--';
  const exportHref = apiBase ? `${apiBase}/live/streams/${stream.id}/export.csv` : undefined;

  return (
    <div className="flex h-full flex-col gap-4 rounded-none border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client Seed</span>
          <p className="break-all text-sm font-medium text-foreground">{stream.clientSeed || '--'}</p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => exportHref && window.open(exportHref, '_blank', 'noopener,noreferrer')}
                  disabled={!exportHref}
                >
                  <IconDownload size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onDelete(stream.id)}>
                  <IconTrash size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete stream</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Server Seed Hash</span>
        <p className="font-mono text-xs text-muted-foreground">
          {stream.serverSeedHashed ? `${stream.serverSeedHashed.slice(0, 16)}...` : '--'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
          {stream.totalBets.toLocaleString()} bets
        </Badge>
        {stream.highestRoundResult && (
          <Badge className="border border-[hsl(var(--chart-2))]/40 bg-[hsl(var(--chart-2))]/15 text-[hsl(var(--chart-2))]">
            Max x{stream.highestRoundResult.toLocaleString()}
          </Badge>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground">Last seen</span>
          <p className="text-sm font-medium text-foreground/80">{lastSeen}</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => onOpen(stream.id)} className="border-border">
                <IconArrowRight size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open live view</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
