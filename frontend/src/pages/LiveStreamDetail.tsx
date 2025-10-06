import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { EventsOn } from '@wails/runtime/runtime';
import { GetStream, UpdateNotes, DeleteStream, ExportCSV, IngestInfo } from '@wails/go/livehttp/LiveModule';
import { livestore } from '@wails/go/models';
import LiveBetsTable from '@/components/LiveBetsTable';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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

function formatDateTime(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function InfoChip(props: { label: string; value: string; copyable?: boolean }) {
  const { label, value, copyable } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy value', err);
      toast.error('Failed to copy value');
    }
  }, [value]);

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground"
      title={value}
    >
      <span className="font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <span className="max-w-[200px] truncate font-medium text-foreground md:max-w-[260px]">{value || '—'}</span>
      {copyable && value && (
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-border/70 bg-background/80 p-1 text-foreground/80 transition hover:border-[hsl(var(--primary))]/60 hover:text-[hsl(var(--primary))]"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </button>
      )}
    </div>
  );
}

function MetricChip(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <div className="flex flex-col rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <span className="mt-1 text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

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

  const streamMeta = useMemo(() => {
    if (!detail) return null;
    return {
      id: detail.id,
      serverSeedHashed: detail.server_seed_hashed,
      clientSeed: detail.client_seed,
      createdAt: detail.created_at,
      lastSeenAt: detail.last_seen_at,
      notes: detail.notes ?? '',
      totalBets: detail.total_bets ?? null,
      highestMultiplier: detail.highest_round_result ?? null,
    };
  }, [detail]);

  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    setNotesDraft(streamMeta?.notes ?? '');
  }, [streamMeta?.notes]);

  const notesDirty = streamMeta ? notesDraft !== (streamMeta.notes ?? '') : false;

  if (loading && !detail) {
    return (
      <div className="flex flex-col gap-6 px-6 pb-12 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-[60vh] rounded-2xl" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex flex-col gap-4 px-6 pb-12 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            className="gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/live')}
          >
            <IconArrowLeft size={16} />
            Back to streams
          </Button>
          <Badge className="border border-destructive/40 bg-destructive/10 text-destructive">Error</Badge>
        </div>
        <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm">{error}</p>
          <div className="flex gap-2">
            <Button onClick={() => load()} variant="destructive">
              Try again
            </Button>
            <Button variant="outline" onClick={() => navigate('/live')}>
              Back to list
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 xl:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/live')}
          >
            <IconArrowLeft size={16} />
            Back to streams
          </Button>
          {streamMeta && (
            <Badge className="border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
              Live stream
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="gap-2" onClick={onExportCsv}>
            Export CSV
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            disabled={deleting}
            onClick={onDeleteStream}
          >
            {deleting ? 'Deleting…' : 'Delete stream'}
          </Button>
        </div>
      </div>

      {streamMeta && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2 rounded-full border border-success-500/40 bg-success-500/10 px-3 py-1 font-semibold text-success-500">
              <span className="h-2 w-2 rounded-full bg-success-500" /> Live connection
            </span>
            <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 font-medium text-foreground/80">
              Stream ID {streamMeta.id}
            </span>
            {streamMeta.totalBets != null && (
              <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 font-medium text-foreground/80">
                {streamMeta.totalBets.toLocaleString()} bets observed
              </span>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div className="flex flex-col gap-4">
              <LiveBetsTable streamId={streamId} minMultiplier={0} apiBase={apiBase} />
            </div>

            <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
              <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">Stream metadata</span>
                  {streamMeta.highestMultiplier != null && (
                    <Badge className="border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                      Peak ×{streamMeta.highestMultiplier.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 space-y-3">
                  <InfoChip label="Server hash" value={streamMeta.serverSeedHashed} copyable />
                  <InfoChip label="Client seed" value={streamMeta.clientSeed} copyable />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <MetricChip
                    label="Total bets"
                    value={streamMeta.totalBets != null ? streamMeta.totalBets.toLocaleString() : '0'}
                  />
                  <MetricChip label="Created" value={formatDateTime(streamMeta.createdAt)} />
                  <MetricChip label="Last seen" value={formatDateTime(streamMeta.lastSeenAt)} />
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Notes</span>
                    <span className="text-xs text-muted-foreground">Document observations or follow-ups.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setNotesDraft(streamMeta.notes ?? '')} disabled={!notesDirty}>
                      Reset
                    </Button>
                    <Button className="gap-2" onClick={() => onSaveNotes(notesDraft)} disabled={!notesDirty || savingNotes}>
                      {savingNotes ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
                <Textarea
                  className="mt-3 h-40 resize-y text-sm"
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Add observations about this stream…"
                />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
