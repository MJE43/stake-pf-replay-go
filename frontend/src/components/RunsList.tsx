import { useState, useEffect, useMemo } from 'react';
import { IconAlertCircle, IconHistory, IconPlus, IconRefresh, IconSearch, IconChartBar } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ListRuns } from '@wails/go/bindings/App';
import { bindings } from '@wails/go/models';
import { RunsTable } from '@/components/RunsTable';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

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

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Header navigate={navigate} refresh={refresh} loading={loading} />
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive backdrop-blur-md">
          <IconAlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error loading scan history</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Header navigate={navigate} refresh={refresh} loading={loading} />

      {runsData && runsData.totalCount !== undefined && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Scans" value={runsData.totalCount.toLocaleString()} icon={IconChartBar} color="text-primary" />
          <StatCard label="Current Page" value={`${currentQuery.page} / ${totalPages}`} icon={IconHistory} color="text-blue-400" />
          <StatCard label="Per Page" value={String(currentQuery.perPage)} icon={IconSearch} color="text-amber-400" />
          {currentQuery.game && (
            <div className="rounded-xl border border-white/5 bg-card/40 p-4 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Filter</div>
              <Badge className="border-primary/30 bg-primary/15 text-primary font-semibold">
                {currentQuery.game.toUpperCase()}
              </Badge>
            </div>
          )}
        </div>
      )}

      <div className="relative rounded-xl border border-white/5 bg-card/40 overflow-hidden backdrop-blur-md">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading runs...</span>
            </div>
          </div>
        )}

        {!loading && runsData && runsData.runs && runsData.runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 p-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <IconHistory size={36} className="text-muted-foreground/50" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xl font-bold text-foreground">No scan history yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                You haven't run any scans. Start by creating your first provable fairness analysis.
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

function Header({ navigate, refresh, loading }: { navigate: (path: string) => void; refresh: () => void; loading: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-400 ring-1 ring-white/10 shadow-lg shadow-blue-500/10">
          <IconHistory size={24} />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Scan History</h1>
          <p className="text-sm text-muted-foreground">View and manage your previous scan results.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2 border-white/10 bg-white/5 hover:bg-white/10" onClick={refresh} disabled={loading}>
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
        <Button size="sm" className="gap-2" onClick={() => navigate('/')}>
          <IconPlus size={14} />
          New Scan
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="group rounded-xl border border-white/5 bg-card/40 p-4 backdrop-blur-md transition-all hover:bg-card/60">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
          <div className={`text-2xl font-bold font-mono ${color || 'text-foreground'}`}>{value}</div>
        </div>
        <div className={`rounded-lg bg-white/5 p-2 ring-1 ring-white/10 ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
