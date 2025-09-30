import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';
import { GetRun, GetSeedRuns } from '@wails/go/bindings/App';
import { bindings, store } from '@wails/go/models';
import { RunSummary, HitsTable, SeedRunWorkspace } from '@/components';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { waitForWailsBinding } from '@/lib/wails';

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<store.Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedGroup, setSeedGroup] = useState<bindings.SeedRunGroup | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const refreshGroup = useCallback(
    async (runId?: string) => {
      const targetId = runId ?? id;
      if (!targetId) {
        return;
      }

      try {
        setGroupLoading(true);
        await waitForWailsBinding(['go', 'bindings', 'App', 'GetSeedRuns'], { timeoutMs: 10_000 });
        const groupData = await GetSeedRuns(targetId);
        setSeedGroup(groupData);
        setGroupError(null);
      } catch (err) {
        console.error('Failed to load related runs', err);
        setGroupError(err instanceof Error ? err.message : 'Failed to load related runs');
      } finally {
        setGroupLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) {
      setError('Run ID is required');
      setLoading(false);
      return;
    }

    const fetchRun = async () => {
      try {
        setLoading(true);
        setError(null);
        const runData = await GetRun(id);
        setRun(runData);
        await refreshGroup(id);
      } catch (err) {
        console.error('Failed to fetch run:', err);
        setError(err instanceof Error ? err.message : 'Failed to load run details');
      } finally {
        setLoading(false);
      }
    };

    fetchRun();
  }, [id, refreshGroup]);

  const statusBadge = useMemo(() => {
    if (!run) return null;
    if (run.timed_out) {
      return (
        <Badge className="gap-1 border border-amber-400/60 bg-amber-500/15 text-amber-200">
          <IconClock size={12} />
          <span>Timed Out</span>
        </Badge>
      );
    }
    if (run.hit_count > 0) {
      return (
        <Badge className="gap-1 border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
          <IconCheck size={12} />
          <span>Completed</span>
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 border border-border bg-secondary/40 text-muted-foreground">
        <IconX size={12} />
        <span>No Hits</span>
      </Badge>
    );
  }, [run]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
        <Button variant="ghost" className="w-fit gap-2 text-muted-foreground" disabled>
          <IconArrowLeft size={16} />
          Back to scan history
        </Button>
        <div className="rounded-none border border-border bg-card p-8 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3 text-[hsl(var(--primary))]">
            <IconLoader2 className="animate-spin" size={20} />
            <p className="text-sm text-muted-foreground">Loading run details...</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
        <Button
          variant="ghost"
          className="w-fit gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/runs')}
        >
          <IconArrowLeft size={16} />
          Back to scan history
        </Button>
        <Alert variant="destructive" icon={<IconAlertCircle size={20} />} title="Error loading run">
          {error ?? 'Run not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/runs')}
        >
          <IconArrowLeft size={16} />
          Back to scan history
        </Button>
        {statusBadge}
      </div>

      {groupError && (
        <Alert variant="destructive" icon={<IconAlertCircle size={18} />} title="Related runs unavailable">
          {groupError}
        </Alert>
      )}

      {seedGroup && run && (
        <SeedRunWorkspace
          currentRun={run}
          group={seedGroup}
          groupLoading={groupLoading}
          refreshGroup={refreshGroup}
          onRunSelected={(runId) => {
            if (runId !== run.id) {
              navigate(`/runs/${runId}`);
            }
          }}
          onRunCreated={(runId) => {
            if (runId !== run.id) {
              navigate(`/runs/${runId}`);
            }
          }}
        />
      )}

      <RunSummary run={run} />

      <HitsTable runId={run.id} />
    </div>
  );
}
