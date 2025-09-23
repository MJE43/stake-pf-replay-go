import { normalizeLiveBet, type RawLiveBet } from '@/lib/live-normalizers';
import type { LiveBetPage } from '@/types/live';
import { callWithRetry, waitForWailsBinding } from '@/lib/wails';

const GET_BETS_PAGE_PATH: string[] = ['go', 'livehttp', 'LiveModule', 'GetBetsPage'];

export async function loadBetsPageViaBridge(options: {
  streamId: string;
  minMultiplier: number;
  order: 'asc' | 'desc';
  pageSize: number;
  offset: number;
}): Promise<LiveBetPage> {
  const { streamId, minMultiplier, order, pageSize, offset } = options;
  await waitForWailsBinding(GET_BETS_PAGE_PATH, { timeoutMs: 10_000 });
  const fn = (window as any)?.go?.livehttp?.LiveModule?.GetBetsPage;
  if (typeof fn !== 'function') {
    throw new Error('LiveModule.GetBetsPage binding is not available');
  }
  type RawPage = {
    rows?: unknown[];
    total?: number;
  };

  const result = await callWithRetry<RawPage>(
    () => fn(streamId, minMultiplier, order, pageSize, offset),
    4,
    250,
  );
  const rawRows: RawLiveBet[] = Array.isArray(result?.rows) ? (result.rows as RawLiveBet[]) : [];
  const rows = rawRows.map(normalizeLiveBet);
  const total = typeof result?.total === 'number' ? result.total : null;
  return { rows, total };
}
