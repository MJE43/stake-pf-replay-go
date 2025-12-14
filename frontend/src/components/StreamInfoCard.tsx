import { useEffect, useMemo, useState } from 'react';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconHash,
  IconKey,
  IconTrash,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 opacity-60 hover:opacity-100 hover:bg-primary/10 hover:text-primary',
              copied && 'bg-cyan-500/20 text-cyan-400 opacity-100',
            )}
            onClick={handleCopy}
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{copied ? 'Copied' : `Copy ${label}`}</TooltipContent>
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

  return (
    <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/5 bg-card/40 p-5 shadow-sm backdrop-blur-md">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                        <IconHash size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground/90">Stream Info</span>
                        <span className="text-xs text-muted-foreground font-mono tracking-tight opacity-80">{summary.id}</span>
                    </div>
                </div>
                
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="sm" className="h-8 border-white/10 bg-white/5 text-xs hover:bg-white/10">
                            Actions
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

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="uppercase tracking-wider font-semibold">Server Seed Hash</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/5 bg-black/20 p-2 pl-3">
                         <IconKey size={14} className="text-muted-foreground/50 shrink-0" />
                         <code className="flex-1 truncate text-xs font-mono text-foreground/80">{summary.serverSeedHashed || '--'}</code>
                         {summary.serverSeedHashed && <CopyButton value={summary.serverSeedHashed} label="Server Seed" />}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="uppercase tracking-wider font-semibold">Client Seed</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/5 bg-black/20 p-2 pl-3">
                         <IconKey size={14} className="text-muted-foreground/50 shrink-0" />
                         <code className="flex-1 truncate text-xs font-mono text-foreground/80">{summary.clientSeed || '--'}</code>
                         {summary.clientSeed && <CopyButton value={summary.clientSeed} label="Client Seed" />}
                    </div>
                </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Bets</div>
                    <div className="text-lg font-bold font-mono">{summary.totalBets?.toLocaleString() ?? '--'}</div>
                </div>
                 <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Peak Multiplier</div>
                    <div className="text-lg font-bold font-mono text-primary">{summary.highestMultiplier?.toLocaleString() ?? '--'}×</div>
                </div>
            </div>
            
             <div className="mt-4 flex justify-between text-[10px] text-muted-foreground border-t border-white/5 pt-3">
                <span>Created: {created}</span>
                <span>Last seen: {lastSeen}</span>
            </div>
        </div>

      <div className="rounded-xl border border-white/5 bg-card/40 p-5 shadow-sm backdrop-blur-md flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground/90">Field Notes</span>
             <div className="flex gap-2">
                {notesDirty && (
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[10px]" 
                        onClick={() => {
                            setNotes(summary.notes ?? '');
                            setEditing(false);
                        }}
                    >
                        Reset
                    </Button>
                )}
                <Button 
                    variant={notesDirty ? "default" : "secondary"}
                    size="sm" 
                    className="h-6 px-3 text-[10px]"
                    onClick={() => {
                        onSaveNotes(notes);
                        setEditing(false);
                    }}
                    disabled={!notesDirty || isSavingNotes}
                >
                    {isSavingNotes ? 'Saving...' : 'Save'}
                </Button>
             </div>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => {
              if (!editing) setEditing(true);
              setNotes(event.target.value);
            }}
            rows={8}
            className="resize-none border-white/10 bg-black/20 font-mono text-xs text-foreground/90 focus-visible:ring-primary/30"
            placeholder="Add observations about this stream..."
          />
      </div>
    </div>
  );
}
