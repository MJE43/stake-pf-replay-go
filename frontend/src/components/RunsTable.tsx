import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight, IconFilter } from '@tabler/icons-react';
import { bindings, store } from '@wails/go/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RunsTableProps {
  data: bindings.RunsList;
  query: bindings.RunsQuery;
  onQueryChange: (query: Partial<bindings.RunsQuery>) => void;
}

const GAME_OPTIONS = [
  { label: 'All games', value: undefined },
  { label: 'Limbo', value: 'limbo' },
  { label: 'Dice', value: 'dice' },
  { label: 'Roulette', value: 'roulette' },
  { label: 'Pump', value: 'pump' },
];

function formatTimeAgo(iso: string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '--';
  }
}

function getStatus(run: store.Run) {
  if (run.timed_out) {
    return { label: 'Timeout', tone: 'bg-amber-500/15 text-amber-600' };
  }
  if (run.hit_count > 0) {
    return { label: 'Complete', tone: 'bg-emerald-500/15 text-emerald-600' };
  }
  return { label: 'Running', tone: 'bg-indigo-500/15 text-indigo-600' };
}

export function RunsTable({ data, query, onQueryChange }: RunsTableProps) {
  const navigate = useNavigate();
  const runs = data?.runs ?? [];

  const pageTotal = useMemo(() => {
    const perPage = query.perPage ?? 25;
    return Math.max(1, Math.ceil((data?.totalCount ?? 0) / perPage));
  }, [data?.totalCount, query.perPage]);

  const handleGameFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value || undefined;
    onQueryChange({ game: value as bindings.RunsQuery['game'], page: 1 });
  };

  const startIndex = (query.page - 1) * (query.perPage ?? 25) + 1;
  const endIndex = Math.min(query.page * (query.perPage ?? 25), data.totalCount ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <IconFilter size={16} className="text-slate-500" />
          <span>Filter by game:</span>
          <select
            value={query.game ?? ''}
            onChange={handleGameFilter}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            {GAME_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500">
          Page {query.page} of {pageTotal}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[120px] px-3 py-2 text-left">Run ID</th>
              <th className="w-[160px] px-3 py-2 text-left">Created</th>
              <th className="w-[100px] px-3 py-2 text-left">Game</th>
              <th className="w-[200px] px-3 py-2 text-left">Nonce range</th>
              <th className="w-[120px] px-3 py-2 text-left">Hits</th>
              <th className="w-[140px] px-3 py-2 text-left">Progress</th>
              <th className="w-[120px] px-3 py-2 text-left">Status</th>
              <th className="w-[80px] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const status = getStatus(run);
              const range = run.nonce_end - run.nonce_start;
              const progress = range > 0 ? Math.min(100, (run.total_evaluated / range) * 100) : 0;
              return (
                <tr key={run.id} className="odd:bg-white even:bg-slate-50/40">
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                    {run.id.slice(0, 8)}...
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                      <span>{formatTimeAgo(run.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className="bg-indigo-500/10 text-indigo-600 uppercase">{run.game}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                    {run.nonce_start.toLocaleString()} - {run.nonce_end.toLocaleString()}
                    <div className="text-[10px] text-slate-500">{range.toLocaleString()} nonces</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col text-xs">
                      <span className={run.hit_count > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-500'}>
                        {run.hit_count.toLocaleString()}
                      </span>
                      {run.total_evaluated > 0 && (
                        <span className="text-[10px] text-slate-500">
                          {((run.hit_count / run.total_evaluated) * 100).toFixed(3)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${progress.toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{progress.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-indigo-600"
                      onClick={() => navigate(`/runs/${run.id}`)}
                    >
                      View
                      <IconArrowRight size={14} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Showing {startIndex} - {endIndex} of {data.totalCount ?? 0}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => onQueryChange({ page: Math.max(1, (query.page ?? 2) - 1) })}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page >= pageTotal}
            onClick={() => onQueryChange({ page: Math.min(pageTotal, (query.page ?? 1) + 1) })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
