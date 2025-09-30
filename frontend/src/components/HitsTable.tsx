import { useState, useEffect, useRef } from 'react';
import { IconAlertCircle, IconTable } from '@tabler/icons-react';
import { GetRunHits } from '@wails/go/bindings/App';
import { store } from '@wails/go/models';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';

interface HitsTableProps {
  runId: string;
}

export function HitsTable({ runId }: HitsTableProps) {
  const [data, setData] = useState<store.HitWithDelta[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bindingsReady = useRef<Promise<void> | null>(null);

  const fetchHits = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!bindingsReady.current) {
        bindingsReady.current = waitForWailsBinding(['go', 'bindings', 'App', 'GetRunHits'], {
          timeoutMs: 10_000,
        });
      }
      await bindingsReady.current;

      const perPage = 500;
      const combined: store.HitWithDelta[] = [];
      let page = 1;
      let expected = 0;
      while (true) {
        const pageData = await callWithRetry(() => GetRunHits(runId, page, perPage), 4, 250);
        if (!pageData) break;
        const hits = pageData.hits ?? [];
        if (hits.length) {
          combined.push(...hits);
        }
        expected = pageData.totalCount ?? expected;
        if (pageData.totalPages && pageData.page && pageData.page >= pageData.totalPages) {
          break;
        }
        if (hits.length < perPage) {
          break;
        }
        if (expected && combined.length >= expected) {
          break;
        }
        page += 1;
      }

      setData(combined);
      setTotalCount(expected || combined.length);
    } catch (err) {
      console.error('Failed to fetch hits:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hits');
      setData([]);
      setTotalCount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHits();
  }, [runId]);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive shadow-md">
        <div className="flex items-start gap-3">
          <IconAlertCircle size={20} />
          <div>
            <h3 className="text-base font-semibold">Unable to load hits</h3>
            <p className="mt-1 text-sm">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 border border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive/30"
              onClick={fetchHits}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card/90 p-6 shadow-md">
        <div className="flex items-center gap-3 text-[hsl(var(--primary))]">
          <IconTable size={20} />
          <div className="flex flex-col">
            <h3 className="text-base font-semibold text-foreground">Hit Results</h3>
            <p className="text-sm text-muted-foreground">Loading hits...</p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/90 p-6 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[hsl(var(--primary))]">
          <IconTable size={20} />
          <div className="flex flex-col">
            <h3 className="text-base font-semibold text-foreground">Hit Results</h3>
            <p className="text-sm text-muted-foreground">Detailed breakdown of all matching nonces.</p>
          </div>
        </div>
        {data.length > 0 && (
          <Badge className="border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
            {(totalCount ?? data.length).toLocaleString()} hits
          </Badge>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border/60 bg-card/60">
        <table className="min-w-full border-separate border-spacing-0 text-sm leading-6 text-foreground/85">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-foreground/70">Nonce</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground/70">Metric</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground/70">Delta</th>
            </tr>
          </thead>
          <tbody>
            {data.map((hit) => (
              <tr
                key={`${hit.nonce}-${hit.delta_nonce ?? 'na'}`}
                className="group border-b border-border/40 bg-card/40 transition-colors last:border-0 hover:bg-muted/50"
              >
                <td className="px-3 py-2 font-mono text-xs md:text-sm text-muted-foreground tabular-nums tracking-tight">
                  {hit.nonce.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs md:text-sm font-semibold text-foreground tabular-nums tracking-tight">
                  {hit.metric.toFixed(6)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs md:text-sm text-muted-foreground tabular-nums tracking-tight">
                  {hit.delta_nonce != null ? hit.delta_nonce.toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
