import {
  MantineReactTable,
  type MRT_Cell,
  type MRT_ColumnDef,
  type MRT_Row,
  useMantineReactTable,
} from 'mantine-react-table';
import {
  ActionIcon,
  Badge,
  Divider,
  Group,
  Loader,
  NumberFormatter,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import {
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import clsx from 'clsx';
import { IconRadar, IconRefresh } from '@tabler/icons-react';
import { GetBets, Tail } from '../../wailsjs/go/livehttp/LiveModule';
import { livestore } from '../../wailsjs/go/models';
import classes from './LiveBetsTable.module.css';

type RawLiveBet = livestore.LiveBet | Record<string, unknown>;

// Normalize LiveBet from either the Wails model or HTTP responses
function normalizeLiveBet(raw: RawLiveBet): LiveBet {
  const bet = raw as Record<string, unknown>;
  const amount = Number(bet.amount ?? 0);
  const payout = Number(bet.payout ?? 0);
  const roundResult = Number(bet.round_result ?? bet.roundResult ?? 0);
  const roundTarget = bet.round_target ?? bet.roundTarget;
  const difficulty = (bet.difficulty as LiveBet['difficulty']) ?? 'easy';
  const isoDate = bet.date_time ?? bet.dateTime;

  return {
    id: Number(bet.id ?? 0),
    nonce: Number(bet.nonce ?? 0),
    date_time: typeof isoDate === 'string' && isoDate ? new Date(isoDate).toISOString() : undefined,
    amount: Number.isFinite(amount) ? amount : 0,
    payout: Number.isFinite(payout) ? payout : 0,
    difficulty,
    round_target: roundTarget != null ? Number(roundTarget) : undefined,
    round_result: Number.isFinite(roundResult) ? roundResult : 0,
  };
}

// Types aligned to the HTTP API
export type LiveBet = {
  id: number;
  nonce: number;
  date_time?: string; // ISO
  amount: number;
  payout: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  round_target?: number;
  round_result: number; // source of truth for multiplier
};

type BetsPage = { total: number | null; rows: LiveBet[] };

type WailsGetBetsShape = livestore.LiveBet[] | {
  rows?: livestore.LiveBet[];
  total?: number;
} | [livestore.LiveBet[], number];

type HttpBetsResponse = {
  rows?: RawLiveBet[];
  total?: number | null;
};

function unpackGetBets(result: WailsGetBetsShape): { rows: livestore.LiveBet[]; total: number | null } {
  if (!result) {
    return { rows: [], total: null };
  }

  if (Array.isArray(result)) {
    // Multiple returns from Go may come back as [rows, total]
    if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
      return { rows: result[0] as livestore.LiveBet[], total: result[1] ?? null };
    }
    // Or a plain array of rows
    if (result.length === 0 || typeof result[0] === 'object') {
      return { rows: result as livestore.LiveBet[], total: null };
    }
  }

  if (typeof result === 'object') {
    const obj = result as { rows?: livestore.LiveBet[]; total?: number };
    if (Array.isArray(obj.rows)) {
      return { rows: obj.rows, total: typeof obj.total === 'number' ? obj.total : null };
    }
  }

  return { rows: [], total: null };
}

function mergeRows(existing: LiveBet[], incoming: LiveBet[], order: 'asc' | 'desc'): LiveBet[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((bet) => bet.id));
  const fresh = incoming.filter((bet) => !seen.has(bet.id));
  if (!fresh.length) return existing;
  return order === 'desc' ? [...fresh.reverse(), ...existing] : [...existing, ...fresh];
}

export type LiveBetsTableV2Props = {
  streamId: string;
  apiBase?: string;
  pageSize?: number; // default 1000
  pollMs?: number; // default 1200
  defaultOrder?: 'asc' | 'desc';
};

export default function LiveBetsTableV2({
  streamId,
  apiBase,
  pageSize = 1000,
  pollMs = 1200,
  defaultOrder = 'asc',
}: LiveBetsTableV2Props) {
  const queryClient = useQueryClient();
  const [minMultiplier, setMinMultiplier] = useState<number | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>(defaultOrder);
  const [isConnected, setIsConnected] = useState(true);
  const lastIDRef = useRef<number>(0);
  const isInitialisedRef = useRef(false);

  const queryKey = useMemo(
    () =>
      [
        'live-bets',
        streamId,
        { min: minMultiplier ?? 0, order, pageSize, source: apiBase ?? 'wails' },
      ] as const,
    [streamId, minMultiplier, order, pageSize, apiBase],
  );

  const fetchPage = useCallback(
    async (pageParam: number) => {
      let rows: RawLiveBet[] = [];
      let total: number | null = null;

      const callWails = async () => {
        const response = (await GetBets(
          streamId,
          minMultiplier ?? 0,
          order,
          pageSize,
          pageParam,
        )) as WailsGetBetsShape;
        const unpacked = unpackGetBets(response);
        rows = unpacked.rows;
        total = unpacked.total;
      };

      if (apiBase) {
        try {
          const params = new URLSearchParams({
            limit: String(pageSize),
            offset: String(pageParam),
            order: order === 'desc' ? 'nonce_desc' : 'nonce_asc',
          });
          if (minMultiplier && minMultiplier > 0) {
            params.set('min_multiplier', String(minMultiplier));
          }

          const response = await fetch(`${apiBase}/live/streams/${streamId}/bets?${params.toString()}`);
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          const payload = (await response.json()) as HttpBetsResponse;
          rows = (payload.rows ?? []) as RawLiveBet[];
          total = typeof payload.total === 'number' ? payload.total : null;
        } catch (err) {
          console.warn('HTTP bets fetch failed, falling back to Wails bridge.', err);
          await callWails();
        }
      } else {
        await callWails();
      }

      const normalized = rows.map(normalizeLiveBet);

      if (normalized.length) {
        const maxId = normalized.reduce(
          (max, bet) => (Number.isFinite(bet.id) && bet.id > max ? bet.id : max),
          lastIDRef.current,
        );
        lastIDRef.current = maxId;
      }

      return { rows: normalized, total } satisfies BetsPage;
    },
    [streamId, minMultiplier, order, pageSize, apiBase],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    isPending,
  } = useInfiniteQuery<BetsPage, Error, InfiniteData<BetsPage, number>, QueryKey, number>({
    queryKey,
    queryFn: ({ pageParam = 0 }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage: BetsPage, allPages: BetsPage[]) => {
      if (lastPage.rows.length < pageSize) {
        return undefined;
      }
      const nextOffset = allPages.reduce((sum, page) => sum + page.rows.length, 0);
      return nextOffset;
    },
    refetchOnWindowFocus: false,
    staleTime: 5_000,
    retry: 2,
  });

  const flatRows: LiveBet[] = useMemo(
    () => (data?.pages ?? []).flatMap((page: BetsPage) => page.rows),
    [data?.pages],
  );

  // Reset tail pointer when key inputs change
  useEffect(() => {
    lastIDRef.current = 0;
    isInitialisedRef.current = false;
  }, [streamId, order, minMultiplier, pageSize, apiBase]);

  // Track latest id for tail polling once we have data
  useEffect(() => {
    if (!flatRows.length) return;
    const maxId = flatRows.reduce(
      (max, bet) => (Number.isFinite(bet.id) && bet.id > max ? bet.id : max),
      lastIDRef.current,
    );
    lastIDRef.current = maxId;
    isInitialisedRef.current = true;
  }, [flatRows]);

  useEffect(() => {
    if (isError) return;
    if (!isPending && !isFetching && !isFetchingNextPage) {
      isInitialisedRef.current = true;
    }
  }, [isPending, isFetching, isFetchingNextPage, isError]);

  // Tail polling for fresh bets
  useEffect(() => {
    if (!pollMs) return undefined;

    const timer = window.setInterval(async () => {
      if (!isInitialisedRef.current) return;

      try {
        const tailResponse = await Tail(streamId, lastIDRef.current, pageSize);
        setIsConnected(true);

        const normalizedRows = (tailResponse.rows ?? []).map(normalizeLiveBet);
        if (!normalizedRows.length) return;

        queryClient.setQueryData<InfiniteData<BetsPage, number>>(queryKey, (old) => {
          if (!old) return old;
          const pages = old.pages.map((page, index): BetsPage => {
            if (index === old.pages.length - 1 && order === 'asc') {
              return { ...page, rows: mergeRows(page.rows, normalizedRows, order) };
            }
            if (index === 0 && order === 'desc') {
              return { ...page, rows: mergeRows(page.rows, normalizedRows, order) };
            }
            return page;
          });
          return { ...old, pages };
        });

        if (typeof tailResponse.lastID === 'number') {
          lastIDRef.current = tailResponse.lastID;
        }
      } catch (error) {
        console.warn('Tail poll error:', error);
        setIsConnected(false);
      }
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [streamId, pollMs, pageSize, order, queryClient, queryKey]);

  const distancesById = useMemo(() => {
    const map = new Map<number, number | null>();
    const lastNonceByMultiplier = new Map<number, number>();
    const ascending = [...flatRows].sort((a, b) => a.nonce - b.nonce);
    ascending.forEach((row) => {
      const lastNonce = lastNonceByMultiplier.get(row.round_result);
      const distance = lastNonce != null ? row.nonce - lastNonce : null;
      lastNonceByMultiplier.set(row.round_result, row.nonce);
      map.set(row.id, distance);
    });
    return map;
  }, [flatRows]);

  type Row = LiveBet & { distance: number | null };
  const rowsWithDistance: Row[] = useMemo(
    () => flatRows.map((row) => ({ ...row, distance: distancesById.get(row.id) ?? null })),
    [flatRows, distancesById],
  );

  const totalFetched = flatRows.length;
  const totalReported = data?.pages?.[0]?.total ?? null;

  const metrics = useMemo(() => {
    if (!rowsWithDistance.length) {
      return {
        count: 0,
        wagered: 0,
        payout: 0,
        net: 0,
        avgMultiplier: null as number | null,
        maxMultiplier: null as number | null,
      };
    }

    let totalWagered = 0;
    let totalPayout = 0;
    let multiplierSum = 0;
    let peakMultiplier = 0;

    rowsWithDistance.forEach((row) => {
      const wager = Number.isFinite(row.amount) ? row.amount : 0;
      const pay = Number.isFinite(row.payout) ? row.payout : 0;
      const mult = Number.isFinite(row.round_result) ? row.round_result : 0;

      totalWagered += wager;
      totalPayout += pay;
      multiplierSum += mult;
      peakMultiplier = Math.max(peakMultiplier, mult);
    });

    const count = rowsWithDistance.length;
    return {
      count,
      wagered: totalWagered,
      payout: totalPayout,
      net: totalPayout - totalWagered,
      avgMultiplier: count ? multiplierSum / count : null,
      maxMultiplier: count ? peakMultiplier : null,
    };
  }, [rowsWithDistance]);

  const netColor = metrics.net > 0 ? 'teal.6' : metrics.net < 0 ? 'red.6' : 'gray.6';

  const handleManualRefresh = useCallback(() => {
    lastIDRef.current = 0;
    isInitialisedRef.current = false;
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const fetchMoreOnBottomReached = useCallback(
    (container?: HTMLDivElement | null) => {
      if (!container) return;
      const threshold = 300;
      const reachedBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      if (reachedBottom && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const columns = useMemo<MRT_ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'nonce',
        header: 'Nonce',
        size: 90,
        Cell: ({ cell }: { cell: MRT_Cell<Row> }) => (
          <Text size="sm" ff="var(--mantine-font-family-monospace)">
            {cell.getValue<number>().toLocaleString()}
          </Text>
        ),
      },
      {
        accessorKey: 'round_result',
        header: 'Multiplier',
        size: 120,
        Cell: ({ cell }: { cell: MRT_Cell<Row> }) => {
          const multiplier = cell.getValue<number>();
          const color = multiplier >= 3200
            ? 'red'
            : multiplier >= 400
              ? 'orange'
              : multiplier >= 10
                ? 'yellow'
                : 'green';
          return (
            <Badge color={color} variant="light">
              <NumberFormatter value={multiplier} thousandSeparator />
            </Badge>
          );
        },
      },
      {
        accessorKey: 'distance',
        header: 'Distance',
        size: 110,
        Cell: ({ row }: { row: MRT_Row<Row> }) => {
          const value = row.original.distance;
          if (value == null) return <Text size="sm" c="dimmed">—</Text>;
          return (
            <Text size="sm" ff="var(--mantine-font-family-monospace)">
              {value.toLocaleString()}
            </Text>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 120,
        Cell: ({ cell }: { cell: MRT_Cell<Row> }) => (
          <NumberFormatter
            value={cell.getValue<number>()}
            thousandSeparator
            decimalScale={2}
            fixedDecimalScale
          />
        ),
      },
      {
        accessorKey: 'payout',
        header: 'Payout',
        size: 120,
        Cell: ({ cell }: { cell: MRT_Cell<Row> }) => (
          <NumberFormatter
            value={cell.getValue<number>()}
            thousandSeparator
            decimalScale={2}
            fixedDecimalScale
          />
        ),
      },
      {
        accessorKey: 'difficulty',
        header: 'Diff',
        size: 90,
        Cell: ({ cell }: { cell: MRT_Cell<Row> }) => (
          <Badge variant="outline">{cell.getValue<string>()}</Badge>
        ),
      },
      {
        accessorKey: 'date_time',
        header: 'Time',
        size: 180,
        Cell: ({ cell }: { cell: MRT_Cell<Row> }) => {
          const value = cell.getValue<string | undefined>();
          if (!value) return <Text size="sm" c="dimmed">—</Text>;
          const formatted = new Date(value).toLocaleString();
          return (
            <Text size="sm" ff="var(--mantine-font-family-monospace)">
              {formatted}
            </Text>
          );
        },
      },
    ],
    [],
  );

  const table = useMantineReactTable<Row>({
    columns,
    data: rowsWithDistance,
    enablePagination: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableSorting: false,
    enableRowVirtualization: true,
    mantineTableContainerProps: {
      className: classes.tableScroll,
      onScroll: (event: UIEvent<HTMLDivElement>) => fetchMoreOnBottomReached(event.currentTarget),
    },
    mantineToolbarAlertBannerProps: isError
      ? { color: 'red', children: 'Error loading data' }
      : undefined,
    renderTopToolbarCustomActions: () => (
      <div className={classes.toolbar}>
        <Group gap="xl" className={classes.metrics} wrap="wrap">
          <div className={classes.status}>
            <span
              className={clsx(classes.statusDot, isConnected ? classes.statusDotSuccess : classes.statusDotError)}
            />
            <div className={classes.statusText}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Feed
              </Text>
              <Text size="sm" fw={600}>
                {isConnected ? 'Live' : 'Reconnecting…'}
              </Text>
            </div>
          </div>
          <Divider orientation="vertical" className={classes.toolbarDivider} />
          <div className={classes.metricBlock}>
            <Text className={classes.metricLabel}>Loaded</Text>
            <Text className={classes.metricValue}>
              {metrics.count.toLocaleString()}
              {totalReported != null && ` / ${totalReported.toLocaleString()}`}
            </Text>
          </div>
          <div className={classes.metricBlock}>
            <Text className={classes.metricLabel}>Wagered</Text>
            <Text className={classes.metricValue}>
              <NumberFormatter
                value={metrics.wagered}
                thousandSeparator
                decimalScale={2}
                fixedDecimalScale
              />
            </Text>
          </div>
          <div className={classes.metricBlock}>
            <Text className={classes.metricLabel}>Net</Text>
            <Text className={classes.metricValue} c={netColor}>
              <NumberFormatter
                value={metrics.net}
                thousandSeparator
                decimalScale={2}
                fixedDecimalScale
                prefix={metrics.net > 0 ? '+' : undefined}
              />
            </Text>
          </div>
          {metrics.avgMultiplier != null && (
            <div className={classes.metricBlock}>
              <Text className={classes.metricLabel}>Avg ×</Text>
              <Text className={classes.metricValue}>
                <NumberFormatter
                  value={metrics.avgMultiplier}
                  thousandSeparator
                  decimalScale={2}
                  fixedDecimalScale
                />
              </Text>
            </div>
          )}
          {metrics.maxMultiplier != null && (
            <div className={classes.metricBlock}>
              <Text className={classes.metricLabel}>Peak ×</Text>
              <Text className={classes.metricValue}>
                <NumberFormatter value={metrics.maxMultiplier} thousandSeparator />
              </Text>
            </div>
          )}
          {(isFetching || isFetchingNextPage) && <Loader size="sm" />}
        </Group>
        <Group gap="sm" className={classes.filters} wrap="wrap">
          <Tooltip label="Server-side sorting">
            <SegmentedControl
              size="xs"
              value={order}
              onChange={(value: string) => setOrder(value === 'desc' ? 'desc' : 'asc')}
              data={[
                { label: 'Oldest → Newest', value: 'asc' },
                { label: 'Newest → Oldest', value: 'desc' },
              ]}
            />
          </Tooltip>
          <MinMultiplierControl value={minMultiplier} onChange={setMinMultiplier} />
          <Tooltip label="Refresh data">
            <ActionIcon variant="light" color="violet" onClick={handleManualRefresh}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>
    ),
    renderEmptyRowsFallback: () => (
      <Stack align="center" gap={4} className={classes.emptyState}>
        <IconRadar size={24} stroke={1.5} />
        <Text fw={600}>No bets yet</Text>
        <Text size="sm" c="dimmed">
          Bets will appear here in real time once they are ingested.
        </Text>
      </Stack>
    ),
    rowVirtualizerOptions: {
      overscan: 16,
      estimateSize: () => 36,
    },
    state: {
      isLoading: isPending,
      showAlertBanner: isError,
      showProgressBars: isFetching || isFetchingNextPage,
    },
  });

  return <MantineReactTable table={table} />;
}

function MinMultiplierControl({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Group gap={6} wrap="nowrap" className={classes.minControl}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">
        Min ×
      </Text>
      <NumberInput
        className={classes.numberField}
        size="xs"
        variant="filled"
        value={value ?? undefined}
        placeholder="400"
        min={1}
        step={50}
        hideControls
        onChange={(val: string | number | undefined) => {
          if (val == null || val === '') {
            onChange(null);
            return;
          }
          const numeric = Number(val);
          onChange(Number.isFinite(numeric) ? numeric : null);
        }}
      />
    </Group>
  );
}
