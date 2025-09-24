import { store } from '@wails/go/models';
import {
  IconClock,
  IconTarget,
  IconHash,
  IconDice,
  IconTrendingUp,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RunSummaryProps {
  run: store.Run;
}

export function RunSummary({ run }: RunSummaryProps) {
  let parsedParams: Record<string, unknown> = {};
  try {
    parsedParams = JSON.parse(run.params_json);
  } catch (e) {
    console.warn('Failed to parse params JSON:', e);
  }

  const createdDate = new Date(run.created_at).toLocaleString();
  const hitRate = run.total_evaluated > 0 ? (run.hit_count / run.total_evaluated) * 100 : 0;

  const formatNumber = (num: number | undefined | null, precision = 6) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toFixed(precision);
  };

  return (
    <Card className="border border-border bg-card shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <IconTrendingUp size={20} className="text-[hsl(var(--primary))]" />
          Scan Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scan Parameters</h3>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <IconDice size={16} className="text-[hsl(var(--primary))]" />
              <span className="font-medium">Game:</span>
              <Badge className="border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 uppercase text-[hsl(var(--primary))]">
                {run.game}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <IconHash size={16} className="text-[hsl(var(--primary))]" />
              <span className="font-medium">Server Seed Hash:</span>
              <span className="font-mono text-xs text-muted-foreground">{run.server_seed_hash.substring(0, 16)}...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="font-medium">Client Seed:</span>
              <span className="font-mono text-xs text-muted-foreground">{run.client_seed}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="font-medium">Nonce Range:</span>
              <span>
                {run.nonce_start.toLocaleString()} - {run.nonce_end.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <IconTarget size={16} className="text-[hsl(var(--primary))]" />
              <span className="font-medium">Target:</span>
              <span>
                {run.target_op} {run.target_val} (±{run.tolerance})
              </span>
            </div>
            {Object.keys(parsedParams).length > 0 && (
              <div className="text-sm text-foreground/80">
                <span className="font-medium">Game Parameters:</span>{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  {JSON.stringify(parsedParams)}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Execution Metadata</h3>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <IconClock size={16} className="text-[hsl(var(--primary))]" />
              <span className="font-medium">Created:</span>
              <span>{createdDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="font-medium">Engine Version:</span>
              <Badge variant="outline" className="border-border text-muted-foreground">
                {run.engine_version}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="font-medium">Status:</span>
              <Badge
                className={
                  run.timed_out
                    ? 'border border-amber-400/60 bg-amber-500/15 text-amber-200'
                    : 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                }
              >
                {run.timed_out ? 'Timed Out' : 'Completed'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="font-medium">Hit Limit:</span>
              <span>{run.hit_limit.toLocaleString()}</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Statistics</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Evaluated"
              value={run.total_evaluated.toLocaleString()}
              tone="text-[hsl(var(--primary))]"
            />
            <StatCard label="Hits Found" value={run.hit_count.toLocaleString()} tone="text-emerald-200" />
            <StatCard label="Hit Rate" value={`${hitRate.toFixed(4)}%`} tone="text-amber-200" />
            <StatCard
              label="Summary Count"
              value={run.summary_count ? run.summary_count.toLocaleString() : 'N/A'}
              tone="text-[hsl(var(--chart-2))]"
            />
          </div>
          {(run.summary_min !== undefined || run.summary_max !== undefined || run.summary_sum !== undefined) && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Min Metric" value={formatNumber(run.summary_min)} tone="text-destructive" />
              <StatCard label="Max Metric" value={formatNumber(run.summary_max)} tone="text-teal-200" />
              <StatCard label="Sum Metric" value={formatNumber(run.summary_sum)} tone="text-[hsl(var(--primary))]" />
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  tone: string;
};

function StatCard({ label, value, tone }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-none border border-border bg-secondary/60 p-4 text-center shadow-[var(--shadow-xs)]">
      <span className={`text-xl font-semibold ${tone}`}>{value}</span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
