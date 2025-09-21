import {
  MantineReactTable,
  type MRT_Cell,
  type MRT_ColumnDef,
  type MRT_Row,
  useMantineReactTable,
} from 'mantine-react-table';
import {
  Badge,
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
import { IconRadar } from '@tabler/icons-react';
import { GetBets, Tail } from '../../wailsjs/go/livehttp/LiveModule';
import { livestore } from '../../wailsjs/go/models';
import classes from './LiveBetsTable.module.css';

// Normalize LiveBet from Wails model
function normalizeLiveBet(bet: livestore.LiveBet): LiveBet {
  return {
    id: Number(bet.id),
    nonce: Number(bet.nonce),
    date_time: bet.date_time ? new Date(bet.date_time).toISOString() : undefined,
    amount: Number(bet.amount ?? 0),
    payout: Number(bet.payout ?? 0),
    difficulty: (bet.difficulty as LiveBet['difficulty']) ?? 'easy',
    round_target: bet.round_target != null ? Number(bet.round_target) : undefined,
    round_result: Number(bet.round_result ?? 0),
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
  pageSize?: number; // default 1000
  pollMs?: number; // default 1200
  defaultOrder?: 'asc' | 'desc';
};

export default function LiveBetsTableV2({
  streamId,
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
    () => ['live-bets', streamId, { min: minMultiplier ?? 0, order, pageSize }] as const,
    [streamId, minMultiplier, order, pageSize],
  );

  const fetchPage = useCallback(
    async (pageParam: number) => {
      const response = (await GetBets(
        streamId,
        minMultiplier ?? 0,
        order,
        pageSize,
        pageParam,
      )) as WailsGetBetsShape;

      const { rows, total } = unpackGetBets(response);
      const normalized = rows.map(normalizeLiveBet);

      if (normalized.length) {
        lastIDRef.current = normalized[normalized.length - 1].id;
      }

      return { rows: normalized, total } satisfies BetsPage;
    },
    [streamId, minMultiplier, order, pageSize],
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
  }, [streamId, order, minMultiplier, pageSize]);

  // Track latest id for tail polling once we have data
  useEffect(() => {
    if (flatRows.length) {
      lastIDRef.current = flatRows[flatRows.length - 1]?.id ?? lastIDRef.current;
      isInitialisedRef.current = true;
    }
  }, [flatRows]);

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
        <Group gap="sm" className={classes.metrics} wrap="wrap">
          <div className={classes.status}>
            <span
              className={clsx(classes.statusDot, isConnected ? classes.statusDotSuccess : classes.statusDotError)}
            />
            <Text size="sm" fw={600}>
              {isConnected ? 'Live feed' : 'Reconnecting…'}
            </Text>
          </div>
          <Text size="sm" c="dimmed">
            Loaded {totalFetched.toLocaleString()}
            {totalReported != null && ` / ${totalReported.toLocaleString()}`}
          </Text>
          {(isFetching || isFetchingNextPage) && <Loader size="xs" />}
        </Group>
        <Group gap="sm" className={classes.filters} wrap="wrap">
          <Tooltip label="Server-side sorting">
            <SegmentedControl
              size="xs"
              value={order}
              onChange={(value: string) => setOrder(value === 'desc' ? 'desc' : 'asc')}
              data={[
                { label: 'Nonce ↑', value: 'asc' },
                { label: 'Nonce ↓', value: 'desc' },
              ]}
            />
          </Tooltip>
          <MinMultiplierControl value={minMultiplier} onChange={setMinMultiplier} />
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
    <Group gap={4} wrap="nowrap">
      <Text size="sm" c="dimmed">
        Min ×
      </Text>
      <div className={classes.numberField}>
        <NumberInput
          size="xs"
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
      </div>
    </Group>
  );
}
