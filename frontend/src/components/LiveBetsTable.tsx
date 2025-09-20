import {
    MantineReactTable,
    type MRT_ColumnDef,
    useMantineReactTable,
} from 'mantine-react-table';
import { Badge, Group, NumberFormatter, Text } from '@mantine/core';
import {
    QueryClient,
    useInfiniteQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Types aligned to your HTTP API
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

type BetsPage = { total: number; rows: LiveBet[] };

export type LiveBetsTableV2Props = {
    streamId: string;
    apiBase?: string;          // default http://127.0.0.1:17888
    pageSize?: number;         // default 1000
    pollMs?: number;           // default 1200
    defaultOrder?: 'asc' | 'desc';
};

export default function LiveBetsTableV2({
    streamId,
    apiBase = 'http://127.0.0.1:17888',
    pageSize = 1000,
    pollMs = 1200,
    defaultOrder = 'asc',
}: LiveBetsTableV2Props) {
    const queryClient = useQueryClient();
    const [minMultiplier, setMinMultiplier] = useState<number | null>(null);
    const [order, setOrder] = useState<'asc' | 'desc'>(defaultOrder);
    const [isConnected, setIsConnected] = useState(true);
    const lastIDRef = useRef<number>(0);

    // -------- data fetching (infinite) --------
    const key = ['live-bets', streamId, { minMultiplier, order, pageSize }];

    const fetchPage = useCallback(
        async ({ pageParam }: { pageParam: number }) => {
            const params = new URLSearchParams();
            params.set('limit', String(pageSize));
            params.set('offset', String(pageParam));
            params.set('order', order);
            if (minMultiplier != null) params.set('min_multiplier', String(minMultiplier));
            const r = await fetch(
                `${apiBase}/live/streams/${streamId}/bets?${params.toString()}`,
            );
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const json: BetsPage = await r.json();
            // update lastIDRef if rows exist
            if (json.rows.length) {
                const maxId = json.rows[json.rows.length - 1].id;
                if (maxId > lastIDRef.current) lastIDRef.current = maxId;
            }
            return json;
        },
        [apiBase, streamId, pageSize, order, minMultiplier],
    );

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        isError,
        refetch,
        status,
    } = useInfiniteQuery({
        queryKey: key,
        queryFn: fetchPage,
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            const fetched = allPages.reduce((acc, p) => acc + p.rows.length, 0);
            return fetched < lastPage.total ? fetched : undefined;
        },
        staleTime: 5_000,
        refetchOnWindowFocus: false,
    });

    // -------- live tail poll --------
    useEffect(() => {
        const id = setInterval(async () => {
            // nothing to do until we have initial data
            if (!data?.pages?.length) return;
            
            try {
                const params = new URLSearchParams();
                params.set('since_id', String(lastIDRef.current));
                params.set('limit', String(pageSize));
                const r = await fetch(
                    `${apiBase}/live/streams/${streamId}/tail?${params.toString()}`,
                );
                if (!r.ok) {
                    console.warn(`Tail poll failed: HTTP ${r.status}`);
                    return;
                }
                const json: { rows: LiveBet[]; lastID: number } = await r.json();
                setIsConnected(true);
                
                if (!json.rows?.length) return;

                // append new rows into the last page; keep total unknown here
                queryClient.setQueryData<any>(key, (old: any) => {
                    if (!old?.pages?.length) return old;
                    const pages = [...old.pages];
                    const last = pages[pages.length - 1] as BetsPage;
                    const merged = { ...last, rows: [...last.rows, ...json.rows] };
                    pages[pages.length - 1] = merged;
                    return { ...old, pages };
                });

                lastIDRef.current = json.lastID || lastIDRef.current;
            } catch (error) {
                console.warn('Tail poll error:', error);
                setIsConnected(false);
            }
        }, pollMs);

        return () => clearInterval(id);
    }, [apiBase, streamId, pollMs, pageSize, data?.pages?.length, queryClient, key]);

    // -------- flatten + derived "distance" --------
    const flatRows: LiveBet[] = useMemo(
        () => (data?.pages ?? []).flatMap((p) => p.rows),
        [data],
    );

    const rowsWithDistance = useMemo(() => {
        const lastByMult = new Map<number, number>();
        return flatRows.map((r) => {
            const lastNonce = lastByMult.get(r.round_result);
            const distance =
                lastNonce != null ? r.nonce - lastNonce : null;
            lastByMult.set(r.round_result, r.nonce);
            return { ...r, distance };
        });
    }, [flatRows]);

    const totalFetched = flatRows.length;
    const totalDBRowCount = data?.pages?.[0]?.total ?? 0;

    // -------- virtualization + infinite scroll wiring --------
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const fetchMoreOnBottomReached = useCallback(
        (container?: HTMLDivElement | null) => {
            const el = container ?? tableContainerRef.current;
            if (!el) return;
            const threshold = 300; // px from bottom
            const reachedBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
            if (
                reachedBottom &&
                hasNextPage &&
                !isFetchingNextPage &&
                !fetchingRef.current
            ) {
                fetchingRef.current = true;
                fetchNextPage().finally(() => {
                    fetchingRef.current = false;
                });
            }
        },
        [hasNextPage, isFetchingNextPage, fetchNextPage],
    );

    useEffect(() => {
        const el = tableContainerRef.current;
        if (!el) return;
        const onScroll = () => fetchMoreOnBottomReached(el);
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [fetchMoreOnBottomReached]);

    // -------- columns --------
    type Row = LiveBet & { distance: number | null };
    const columns = useMemo<MRT_ColumnDef<Row>[]>(
        () => [
            {
                accessorKey: 'nonce',
                header: 'Nonce',
                size: 90,
                mantineTableBodyCellProps: { style: { fontFamily: 'ui-monospace' } },
            },
            {
                accessorKey: 'round_result',
                header: 'Multiplier',
                size: 120,
                Cell: ({ cell }) => {
                    const v = cell.getValue<number>();
                    let color: string = 'gray';
                    if (v >= 3200) color = 'red';
                    else if (v >= 400) color = 'orange';
                    else if (v >= 10) color = 'yellow';
                    else color = 'green';
                    return <Badge color={color}>{v.toLocaleString()}</Badge>;
                },
            },
            {
                accessorKey: 'distance',
                header: 'Distance',
                size: 110,
                Cell: ({ cell }) =>
                    cell.getValue<number | null>() ?? <Text c="dimmed">—</Text>,
            },
            {
                accessorKey: 'amount',
                header: 'Amount',
                size: 110,
                Cell: ({ cell }) => (
                    <NumberFormatter value={cell.getValue<number>()} thousandSeparator />
                ),
            },
            {
                accessorKey: 'payout',
                header: 'Payout',
                size: 110,
                Cell: ({ cell }) => (
                    <NumberFormatter value={cell.getValue<number>()} thousandSeparator />
                ),
            },
            {
                accessorKey: 'difficulty',
                header: 'Diff',
                size: 90,
                Cell: ({ cell }) => <Badge variant="light">{cell.getValue<string>()}</Badge>,
            },
            {
                accessorKey: 'date_time',
                header: 'Time',
                size: 180,
                Cell: ({ cell }) => {
                    const s = cell.getValue<string | undefined>();
                    if (!s) return null;
                    const d = new Date(s);
                    return (
                        <Text style={{ fontFamily: 'ui-monospace' }}>
                            {d.toLocaleString()}
                        </Text>
                    );
                },
            },
        ],
        [],
    );

    // -------- MRT instance --------
    const table = useMantineReactTable<Row>({
        columns,
        data: rowsWithDistance,
        enablePagination: false,
        enableRowVirtualization: true, // keep this static; do not toggle at runtime
        manualSorting: true,
        mantineTableContainerProps: {
            ref: tableContainerRef,
            style: { maxHeight: '640px' },
            onScroll: (e) => fetchMoreOnBottomReached(e.currentTarget),
        },
        mantineToolbarAlertBannerProps: isError
            ? { color: 'red', children: 'Error loading data' }
            : undefined,
        onSortingChange: (updater) => {
            // accept only nonce sorting server-side to keep pages coherent
            const next =
                typeof updater === 'function' ? updater([]) : updater ?? [];
            const s = next[0]?.desc ? 'desc' : 'asc';
            setOrder(s as 'asc' | 'desc');
            // hard refetch from offset 0 on server sort change
            queryClient.removeQueries({ queryKey: key });
            refetch();
        },
        rowVirtualizerOptions: {
            overscan: 12,
            estimateSize: () => 32,
        },
        renderTopToolbarCustomActions: () => (
            <Group gap="md">
                <Group gap="xs">
                    <Text fw={600}>Live</Text>
                    <Badge 
                        color={isConnected ? 'green' : 'red'} 
                        variant="dot" 
                        size="sm"
                    >
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                    {totalFetched} / {totalDBRowCount || '—'}
                </Text>
                <MinMultiplierControl
                    value={minMultiplier}
                    onChange={(v) => {
                        setMinMultiplier(v);
                        // reset pages when filter changes
                        queryClient.removeQueries({ queryKey: key });
                        refetch();
                    }}
                />
            </Group>
        ),
        state: {
            isLoading: status === 'pending',
            showAlertBanner: isError,
            showProgressBars: isFetching || isFetchingNextPage,
        },
    });

    return <MantineReactTable table={table} />;
}

// simple control for min multiplier
function MinMultiplierControl({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (v: number | null) => void;
}) {
    return (
        <Group gap="xs">
            <Text size="sm">Min×</Text>
            <input
                type="number"
                min={1}
                step={1}
                value={value ?? ''}
                placeholder="e.g. 400"
                onChange={(e) => {
                    const v = e.target.value;
                    onChange(v === '' ? null : Number(v));
                }}
                style={{
                    width: 100,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'inherit',
                    padding: '4px 8px',
                    borderRadius: 6,
                }}
            />
        </Group>
    );
}