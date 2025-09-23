import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';
import { GetRun } from '@wails/go/bindings/App';
import { store } from '@wails/go/models';
import { RunSummary, HitsTable } from '@/components';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<store.Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error('Failed to fetch run:', err);
        setError(err instanceof Error ? err.message : 'Failed to load run details');
      } finally {
        setLoading(false);
      }
    };

    fetchRun();
  }, [id]);

  const statusBadge = useMemo(() => {
    if (!run) return null;
    if (run.timed_out) {
      return (
        <Badge className="gap-1 bg-amber-500/15 text-amber-600">
          <IconClock size={12} />
          <span>Timed Out</span>
        </Badge>
      );
    }
    if (run.hit_count > 0) {
      return (
        <Badge className="gap-1 bg-emerald-500/15 text-emerald-600">
          <IconCheck size={12} />
          <span>Completed</span>
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-slate-500/15 text-slate-600">
        <IconX size={12} />
        <span>No Hits</span>
      </Badge>
    );
  }, [run]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
        <Button variant="ghost" className="w-fit gap-2 text-slate-500" disabled>
          <IconArrowLeft size={16} />
          Back to scan history
        </Button>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-600">
            <IconLoader2 className="animate-spin" size={20} />
            <p className="text-sm text-slate-500">Loading run details...</p>
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
          className="w-fit gap-2 text-slate-600 hover:text-slate-900"
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
          className="gap-2 text-slate-600 hover:text-slate-900"
          onClick={() => navigate('/runs')}
        >
          <IconArrowLeft size={16} />
          Back to scan history
        </Button>
        {statusBadge}
      </div>

      <RunSummary run={run} />

      <HitsTable runId={run.id} />
    </div>
  );
}
