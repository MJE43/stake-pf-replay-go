import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight, IconFilter, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
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
  { label: 'Plinko', value: 'plinko' },
];

function formatTimeAgo(iso: string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffMins = Math.floor(diff / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '--';
  }
}

function getStatus(run: store.Run) {
  if (run.timed_out) {
    return { label: 'Timeout', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-400' };
  }
  if (run.hit_count > 0) {
    return { label: 'Complete', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' };
  }
  return {
    label: 'Pending',
    tone: 'border-primary/40 bg-primary/10 text-primary',
  };
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
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <IconFilter size={14} className="text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground">Filter:</span>
          <select
            value={query.game ?? ''}
            onChange={handleGameFilter}
            className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-colors"
          >
            {GAME_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ''} className="bg-card text-foreground">
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Page {query.page} of {pageTotal}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-muted-foreground/80">
            <tr>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">Run ID</th>
              <th className="w-[140px] px-4 py-3 text-left font-semibold">Created</th>
              <th className="w-[90px] px-4 py-3 text-left font-semibold">Game</th>
              <th className="w-[180px] px-4 py-3 text-left font-semibold">Nonce Range</th>
              <th className="w-[100px] px-4 py-3 text-right font-semibold">Hits</th>
              <th className="w-[120px] px-4 py-3 text-left font-semibold">Progress</th>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">Status</th>
              <th className="w-[60px] px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {runs.map((run) => {
              const status = getStatus(run);
              const range = run.nonce_end - run.nonce_start;
              const progress = range > 0 ? Math.min(100, (run.total_evaluated / range) * 100) : 0;
              return (
                <tr 
                  key={run.id} 
                  className="group transition-colors hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => navigate(`/runs/${run.id}`)}
                >
                  <td className="px-4 py-3">
                    <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-foreground/70">
                      {run.id.slice(0, 8)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground/80">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(run.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] uppercase font-semibold">
                      {run.game}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-foreground/80">
                        {run.nonce_start.toLocaleString()} → {run.nonce_end.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{range.toLocaleString()} nonces</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-sm font-bold ${run.hit_count > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {run.hit_count.toLocaleString()}
                    </span>
                    {run.total_evaluated > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {((run.hit_count / run.total_evaluated) * 100).toFixed(3)}%
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all"
                          style={{ width: `${progress.toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{progress.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.tone}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/runs/${run.id}`);
                      }}
                    >
                      <IconArrowRight size={14} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-3">
        <span className="text-[11px] text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startIndex}</span> - <span className="font-medium text-foreground">{endIndex}</span> of {data.totalCount ?? 0}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={query.page <= 1}
            onClick={() => onQueryChange({ page: Math.max(1, (query.page ?? 2) - 1) })}
          >
            <IconChevronLeft size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={query.page >= pageTotal}
            onClick={() => onQueryChange({ page: Math.min(pageTotal, (query.page ?? 1) + 1) })}
          >
            <IconChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
