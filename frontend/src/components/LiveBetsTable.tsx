import {
    MantineReactTable,
    type MRT_ColumnDef,
    useMantineReactTable,
} from 'mantine-react-table';
import { Badge, Group, NumberFormatter, Text } from '@mantine/core';
import {
    useInfiniteQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GetBets, Tail } from '../../wailsjs/go/livehttp/LiveModule';
import { livestore } from '../../wailsjs/go/models';

// Normalize LiveBet from Wails model
function normalizeLiveBet(bet: livestore.LiveBet): LiveBet {
    try {
        return {
            id: bet.id,
            nonce: bet.nonce,
            date_time: bet.date_time ? new Date(bet.date_time).toISOString() : undefined,
            amount: bet.amount,
            payout: bet.payout,
            difficulty: bet.difficulty as 'easy' | 'medium' | 'hard' | 'expert',
            round_target: bet.round_target,
            round_result: bet.round_result,
        };
    } catch (error) {
        console.error('Error normalizing bet:', bet, error);
        throw error;
    }
}

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
    pageSize?: number;         // default 1000
    pollMs?: number;           // default 1200
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

    // -------- data fetching (infinite) --------
    const key = ['live-bets', streamId, { minMultiplier, order, pageSize }];

    const fetchPage = useCallback(
        async ({ pageParam }: { pageParam: number }) => {
            try {
                console.log('Fetching bets with params:', {
                    streamId,
                    minMultiplier: minMultiplier ?? 0,
                    order,
                    pageSize,
                    offset: pageParam
                });
                
                // GetBets(streamId, minMultiplier, order, limit, offset)
                const bets = await GetBets(
                    streamId,
                    minMultiplier ?? 0, // 0 means no filter
                    order,
                    pageSize,
                    pageParam
                );
                
                console.log('Received bets:', bets);
                
                // Handle case where bets might be null or undefined
                const betsArray = Array.isArray(bets) ? bets : [];
                const normalizedBets = betsArray.map(normalizeLiveBet);
                
                // update lastIDRef if rows exist
                if (normalizedBets.length) {
                    const maxId = normalizedBets[normalizedBets.length - 1].id;
                    if (maxId > lastIDRef.current) lastIDRef.current = maxId;
                }
                
                // For now, we'll estimate total based on the returned data
                // If we got fewer results than requested, we're at the end
                const total = normalizedBets.length < pageSize ? pageParam + normalizedBets.length : pageParam + normalizedBets.length + pageSize;
                
                console.log('Returning page:', { total, rows: normalizedBets.length });
                return { total, rows: normalizedBets };
            } catch (error) {
                console.error('Failed to fetch bets:', error);
                throw error;
            }
        },
        [streamId, pageSize, order, minMultiplier],
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
                // Tail(streamId, sinceID, limit)
                const tailResponse = await Tail(streamId, lastIDRef.current, pageSize);
                setIsConnected(true);
                
                if (!tailResponse.rows?.length) return;

                const normalizedRows = tailResponse.rows.map(normalizeLiveBet);

                // append new rows into the last page; keep total unknown here
                queryClient.setQueryData<any>(key, (old: any) => {
                    if (!old?.pages?.length) return old;
                    const pages = [...old.pages];
                    const last = pages[pages.length - 1] as BetsPage;
                    const merged = { ...last, rows: [...last.rows, ...normalizedRows] };
                    pages[pages.length - 1] = merged;
                    return { ...old, pages };
                });

                lastIDRef.current = tailResponse.lastID || lastIDRef.current;
            } catch (error) {
                console.warn('Tail poll error:', error);
                setIsConnected(false);
            }
        }, pollMs);

        return () => clearInterval(id);
    }, [streamId, pollMs, pageSize, data?.pages?.length, queryClient, key]);

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
                mantineTableBodyCellProps: { className: 'mono' },
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
                Cell: ({ cell }) => <Badge>{cell.getValue<string>()}</Badge>,
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
                        <Text className="mono">
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
            className: 'table-container',
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
                <div className="status-indicator">
                    <Text fw={600}>Live</Text>
                    <div className={`status-dot status-dot--${isConnected ? 'success' : 'error'}`} />
                    <Text size="sm">{isConnected ? 'Connected' : 'Disconnected'}</Text>
                </div>
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
                    background: 'var(--mantine-color-white)',
                    border: '1px solid var(--mantine-color-gray-3)',
                    color: 'var(--mantine-color-dark-8)',
                    padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
                    borderRadius: 'var(--mantine-radius-md)',
                    fontSize: 'var(--mantine-font-size-sm)',
                }}
            />
        </Group>
    );
}