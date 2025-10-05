import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { EventsOn } from '@wails/runtime/runtime';
import { GetStream, UpdateNotes, DeleteStream, ExportCSV, IngestInfo } from '@wails/go/livehttp/LiveModule';
import { livestore } from '@wails/go/models';
import LiveBetsTable from '@/components/LiveBetsTable';
import StreamInfoCard, { StreamSummary } from '@/components/StreamInfoCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

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

export default function LiveStreamDetailPage(props: { streamId?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const streamId = props.streamId ?? params.id!;
  const [detail, setDetail] = useState<StreamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState<string>('');

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
        try {
          const url = new URL(info.url);
          setApiBase(`${url.protocol}//${url.host}`);
        } catch {
          setApiBase('');
        }
      } catch {
        setApiBase('');
      }
    })();
  }, []);

  useEffect(() => {
    setDetail(null);
    load();
    const off = EventsOn(`live:newrows:${streamId}`, () => {
      load();
    });
    return () => {
      off();
    };
  }, [streamId, load]);

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
      const message = e instanceof Error ? e.message : 'Failed to export CSV';
      toast.error(message);
    }
  }, [streamId]);

  const onSaveNotes = useCallback(async (notes: string) => {
    setSavingNotes(true);
    try {
      await UpdateNotes(streamId, notes);
      setDetail((current) => (current ? { ...current, notes } : current));
      toast.success('Notes updated');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save notes';
      setError(message);
      toast.error(message);
    } finally {
      setSavingNotes(false);
    }
  }, [streamId]);

  const onDeleteStream = useCallback(async () => {
    if (!window.confirm('Delete this stream and all associated bets? This action cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await DeleteStream(streamId);
      toast.success('Stream removed successfully');
      navigate('/live');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete stream';
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }, [streamId, navigate]);

  const summary: StreamSummary | null = useMemo(() => {
    if (!detail) return null;
    return {
      id: detail.id,
      serverSeedHashed: detail.server_seed_hashed,
      clientSeed: detail.client_seed,
      createdAt: detail.created_at,
      lastSeenAt: detail.last_seen_at,
      notes: detail.notes,
      totalBets: detail.total_bets ?? undefined,
      highestMultiplier: detail.highest_round_result ?? undefined,
    } satisfies StreamSummary;
  }, [detail]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/live')}
          >
            <IconArrowLeft size={16} />
            Back to streams
          </Button>
          {detail && (
            <Badge className="border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
              Live stream
            </Badge>
          )}
        </div>
      </div>

      {loading && !detail ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[520px] rounded-xl" />
        </div>
      ) : error && !detail ? (
        <div className="flex flex-col gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm">{error}</p>
          <Button onClick={() => load()} variant="destructive">
            Try again
          </Button>
        </div>
      ) : summary ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
          <StreamInfoCard
            summary={summary}
            onSaveNotes={onSaveNotes}
            onExportCsv={onExportCsv}
            onDeleteStream={onDeleteStream}
            isSavingNotes={savingNotes}
            isDeletingStream={deleting}
          />

          <Card className="flex h-full flex-col border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Live bets</CardTitle>
              <CardDescription>Newest bets appear first. Scroll to load more history.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 px-0 pb-0 pt-4">
              <LiveBetsTable streamId={streamId} minMultiplier={0} apiBase={apiBase} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
