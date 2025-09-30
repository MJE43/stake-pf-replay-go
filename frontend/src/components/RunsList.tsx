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
        <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
          <IconHistory size={24} />
          <h1 className="text-xl font-semibold text-foreground">Scan History</h1>
        </div>
        <p className="text-sm text-muted-foreground">View and manage your previous scan results.</p>
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
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <IconAlertCircle size={18} />
          <div>
            <p className="font-medium">Error loading scan history</p>
            <p className="mt-1 text-xs text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      {header}

      {runsData && runsData.totalCount !== undefined && (
        <div className="grid gap-4 rounded-none border border-border bg-card p-4 shadow-[var(--shadow-sm)] md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total scans</p>
            <p className="text-xl font-semibold text-[hsl(var(--primary))]">
              {runsData.totalCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current page</p>
            <p className="text-xl font-semibold text-[hsl(var(--primary))]">
              {currentQuery.page} of {totalPages}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rows per page</p>
            <p className="text-xl font-semibold text-[hsl(var(--primary))]">{currentQuery.perPage}</p>
          </div>
          {currentQuery.game && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter</p>
              <Badge className="mt-2 border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
                {currentQuery.game.toUpperCase()}
              </Badge>
            </div>
          )}
        </div>
      )}

      <div className="relative rounded-none border border-border bg-card p-2 shadow-[var(--shadow-sm)]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-none bg-card/70 backdrop-blur">
            <span className="animate-pulse text-sm text-muted-foreground">Loading runs...</span>
          </div>
        )}

        {!loading && runsData && runsData.runs && runsData.runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-secondary p-12 text-center">
            <IconHistory size={42} className="text-muted-foreground/60" />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-foreground">No scan history yet</p>
              <p className="text-sm text-muted-foreground">
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
