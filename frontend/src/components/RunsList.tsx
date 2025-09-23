import { useState, useEffect, useMemo } from 'react';
import { IconAlertCircle, IconHistory, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ListRuns } from '@wails/go/bindings/App';
import { bindings } from '@wails/go/models';
import { RunsTable } from '@/components/RunsTable';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function RunsList() {
  const navigate = useNavigate();
  const [runsData, setRunsData] = useState<bindings.RunsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<bindings.RunsQuery>({
    page: 1,
    perPage: 25,
    game: undefined,
  });

  const fetchRuns = async (query: bindings.RunsQuery) => {
    try {
      setLoading(true);
      setError(null);
      await waitForWailsBinding(['go', 'bindings', 'App', 'ListRuns'], { timeoutMs: 10_000 });
      const result = await callWithRetry(() => ListRuns(query), 4, 250);
      setRunsData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load runs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns(currentQuery);
  }, [currentQuery]);

  const handleQueryChange = (patch: Partial<bindings.RunsQuery>) => {
    setCurrentQuery((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? 1,
    }));
  };

  const refresh = () => fetchRuns(currentQuery);

  const totalPages = useMemo(() => {
    if (!runsData?.totalCount || !currentQuery.perPage) return 1;
    return Math.max(1, Math.ceil(runsData.totalCount / currentQuery.perPage));
  }, [runsData?.totalCount, currentQuery.perPage]);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-indigo-600">
          <IconHistory size={24} />
          <h1 className="text-xl font-semibold text-slate-900">Scan History</h1>
        </div>
        <p className="text-sm text-slate-500">View and manage your previous scan results.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="gap-2" onClick={refresh} disabled={loading}>
          <IconRefresh size={16} />
          Refresh
        </Button>
        <Button className="gap-2" onClick={() => navigate('/')}>
          <IconPlus size={16} />
          New Scan
        </Button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
        {header}
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <IconAlertCircle size={18} />
          <div>
            <p className="font-medium">Error loading scan history</p>
            <p className="mt-1 text-xs text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      {header}

      {runsData && runsData.totalCount !== undefined && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total scans</p>
            <p className="text-xl font-semibold text-indigo-600">
              {runsData.totalCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current page</p>
            <p className="text-xl font-semibold text-indigo-600">
              {currentQuery.page} of {totalPages}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rows per page</p>
            <p className="text-xl font-semibold text-indigo-600">{currentQuery.perPage}</p>
          </div>
          {currentQuery.game && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter</p>
              <Badge className="mt-2 bg-indigo-500/10 text-indigo-600">
                {currentQuery.game.toUpperCase()}
              </Badge>
            </div>
          )}
        </div>
      )}

      <div className="relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur">
            <span className="animate-pulse text-sm text-slate-500">Loading runs...</span>
          </div>
        )}

        {!loading && runsData && runsData.runs && runsData.runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-50 p-12 text-center">
            <IconHistory size={42} className="text-slate-300" />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-slate-800">No scan history yet</p>
              <p className="text-sm text-slate-500">
                You haven't run any scans. Start by creating your first scan.
              </p>
            </div>
            <Button className="gap-2" onClick={() => navigate('/')}>
              <IconPlus size={16} />
              Create first scan
            </Button>
          </div>
        ) : runsData && runsData.runs ? (
          <RunsTable data={runsData} query={currentQuery} onQueryChange={handleQueryChange} />
        ) : null}
      </div>
    </div>
  );
}
