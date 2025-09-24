import { useEffect, useMemo, useState } from 'react';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconHash,
  IconKey,
  IconTrash,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHotkeys } from '@/hooks/useHotkeys';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export type StreamSummary = {
  id: string;
  serverSeedHashed: string;
  clientSeed: string;
  createdAt: string; // ISO
  lastSeenAt: string; // ISO
  notes: string;
  totalBets?: number;
  highestMultiplier?: number;
};

type CopyButtonProps = {
  value: string;
  label: string;
};

function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to copy value');
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={`Copy ${label}`}
            variant={copied ? 'default' : 'outline'}
            size="icon"
            className={cn(
              'h-9 w-9 border border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10',
              copied && 'bg-emerald-500 text-white hover:bg-emerald-500/90',
            )}
            onClick={handleCopy}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied' : `Copy ${label}`}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function StreamInfoCard(props: {
  summary: StreamSummary;
  onSaveNotes: (notes: string) => void;
  onExportCsv: () => void;
  onDeleteStream: () => void;
  isSavingNotes?: boolean;
  isDeletingStream?: boolean;
}) {
  const {
    summary,
    onSaveNotes,
    onExportCsv,
    onDeleteStream,
    isSavingNotes,
    isDeletingStream,
  } = props;

  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(summary.notes ?? '');
  const notesDirty = notes !== (summary.notes ?? '');

  useHotkeys([
    {
      combo: 'mod+s',
      handler: () => {
        if (editing && notesDirty) {
          onSaveNotes(notes);
          setEditing(false);
        }
      },
    },
    {
      combo: 'escape',
      handler: () => {
        if (editing) {
          setNotes(summary.notes ?? '');
          setEditing(false);
        }
      },
    },
  ]);

  useEffect(() => {
    setNotes(summary.notes ?? '');
  }, [summary.notes]);

  const created = useMemo(
    () => new Date(summary.createdAt).toLocaleString(),
    [summary.createdAt],
  );
  const lastSeen = useMemo(
    () => new Date(summary.lastSeenAt).toLocaleString(),
    [summary.lastSeenAt],
  );

  const stats = useMemo(
    () => [
      { label: 'Created', value: created },
      { label: 'Last seen', value: lastSeen },
      {
        label: 'Total bets',
        value: summary.totalBets != null ? summary.totalBets.toLocaleString() : '--',
      },
      {
        label: 'Highest ×',
        value:
          summary.highestMultiplier != null ? summary.highestMultiplier.toLocaleString() : '--',
      },
    ],
    [created, lastSeen, summary.totalBets, summary.highestMultiplier],
  );

  return (
    <Card className="w-full border border-border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
              <IconHash size={18} />
            </span>
            <div className="flex flex-col">
              <CardTitle className="text-lg">Stream Information</CardTitle>
              <CardDescription>Overview, exports, and notes</CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="gap-2" onClick={onExportCsv}>
              <IconDownload size={16} />
              Export CSV
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={isDeletingStream}
              onClick={onDeleteStream}
            >
              <IconTrash size={16} />
              {isDeletingStream ? 'Deleting...' : 'Delete Stream'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/50 p-4">
            <Label className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <IconKey size={14} /> Server Seed Hash
            </Label>
            <div className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 break-all text-sm font-medium text-foreground/80">
                {summary.serverSeedHashed || '--'}
              </span>
              {summary.serverSeedHashed && <CopyButton value={summary.serverSeedHashed} label="Server seed" />}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/50 p-4">
            <Label className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <IconKey size={14} /> Client Seed
            </Label>
            <div className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 break-all text-sm font-medium text-foreground/80">
                {summary.clientSeed || '--'}
              </span>
              {summary.clientSeed && <CopyButton value={summary.clientSeed} label="Client seed" />}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6">
        <div className="grid gap-4 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</span>
              <span className="font-mono text-sm text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Notes</span>
              <span className="text-xs text-muted-foreground">Document findings, reminders, or next actions.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
                {notesDirty ? 'Unsaved changes' : editing ? 'Editing' : 'Read-only'}
              </Badge>
            </div>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => {
              if (!editing) setEditing(true);
              setNotes(event.target.value);
            }}
            rows={6}
            className="resize-y font-mono text-sm"
            placeholder="Add observations about this stream..."
          />
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/60 py-4">
        <div className="text-xs text-muted-foreground">
          <p className="font-medium">Stream ID</p>
          <p className="font-mono">{summary.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setNotes(summary.notes ?? '');
              setEditing(false);
            }}
            disabled={!notesDirty}
          >
            Reset
          </Button>
          <Button
            onClick={() => {
              onSaveNotes(notes);
              setEditing(false);
            }}
            disabled={!notesDirty}
            className="gap-2"
          >
            {isSavingNotes ? 'Saving...' : 'Save Notes'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
