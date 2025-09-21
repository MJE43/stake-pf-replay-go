import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ActionIcon,
    Badge,
    Box,
    Button,
    Card,
    Group,
    Loader,
    SimpleGrid,
    Stack,
    Switch,
    Text,
    TextInput,
    Title,
    Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
    IconArrowRight,
    IconDownload,
    IconRefresh,
    IconSearch,
    IconTrash,
} from '@tabler/icons-react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
    ListStreams,
    DeleteStream,
    IngestInfo,
} from '../../wailsjs/go/livehttp/LiveModule';
import { livestore } from '../../wailsjs/go/models';

function normalizeStream(s: livestore.LiveStream) {
    // Convert the number[] ID to a string for easier handling
    const idStr = Array.isArray(s.id) ? s.id.join('-') : String(s.id);

    return {
        id: idStr,
        serverSeedHashed: s.server_seed_hashed ?? '',
        clientSeed: s.client_seed ?? '',
        createdAt: s.created_at ? new Date(s.created_at).toISOString() : '',
        lastSeenAt: s.last_seen_at ? new Date(s.last_seen_at).toISOString() : '',
        notes: s.notes ?? '',
        totalBets: s.total_bets ?? 0,
        highestRoundResult: s.highest_result ?? undefined,
    };
}

export default function LiveStreamsListPage() {
    const navigate = useNavigate();
    const [streams, setStreams] = useState<ReturnType<typeof normalizeStream>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebouncedValue(search, 200);
    const [autoFollow, setAutoFollow] = useState(false);
    const [apiBase, setApiBase] = useState<string>(''); // for export links

    // get export base once
    useEffect(() => {
        (async () => {
            try {
                const info = await IngestInfo();
                // extract base (http://127.0.0.1:PORT)
                try {
                    const url = new URL(info.url);
                    setApiBase(`${url.protocol}//${url.host}`);
                } catch {
                    setApiBase('');
                }
            } catch {
                setApiBase('');
            }
        })();
    }, []);

    const load = async () => {
        try {
            setError(null);
            console.log('Loading streams...');
            const rows = await ListStreams(200, 0); // recent first from backend
            console.log('Loaded streams:', rows.length);
            setStreams(rows.map(normalizeStream));
        } catch (e: any) {
            console.error('Failed to load streams:', e);
            setError(e?.message || 'Failed to load streams');
        } finally {
            setLoading(false);
        }
    };

    // initial + periodic refresh
    useEffect(() => {
        setLoading(true);
        load();
        const id = setInterval(load, 2500);
        return () => clearInterval(id);
    }, []);

    // Temporarily disabled event-based refresh to debug the loading issue
    // useEffect(() => {
    //     // subscribe to known streams; rebuild whenever list changes
    //     const unsubscribeFunctions: Array<() => void> = [];
    //     for (const s of streams) {
    //         const unsubscribe = EventsOn(`live:newrows:${s.id}`, () => {
    //             console.log(`Event received for stream ${s.id}, reloading...`);
    //             load();
    //         });
    //         unsubscribeFunctions.push(unsubscribe);
    //     }
    //     return () => {
    //         for (const unsubscribe of unsubscribeFunctions) {
    //             unsubscribe();
    //         }
    //     };
    // }, [streams]);

    // filtered + sorted list (lastSeen desc)
    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const arr = [...streams];
        arr.sort((a, b) => {
            const ta = Date.parse(a.lastSeenAt || a.createdAt || '1970-01-01');
            const tb = Date.parse(b.lastSeenAt || b.createdAt || '1970-01-01');
            return tb - ta;
        });
        if (!q) return arr;
        return arr.filter((s) => {
            const hash = s.serverSeedHashed?.toLowerCase() ?? '';
            const client = s.clientSeed?.toLowerCase() ?? '';
            return hash.includes(q) || client.includes(q);
        });
    }, [streams, debouncedSearch]);

    // auto-follow latest when enabled and there is at least one stream
    const lastAutoFollowed = useRef<string | null>(null);
    useEffect(() => {
        if (!autoFollow || filtered.length === 0 || loading || error) return;
        const latest = filtered[0];
        // Only auto-follow if we have a valid stream with recent activity
        if (latest?.id && latest.id !== lastAutoFollowed.current && latest.totalBets > 0) {
            lastAutoFollowed.current = latest.id;
            // Add a small delay to ensure the stream is fully loaded
            setTimeout(() => {
                navigate(`/live/${latest.id}`);
            }, 100);
        }
    }, [autoFollow, filtered, navigate, loading, error]);

    const onDelete = async (id: string) => {
        if (!confirm('Delete this stream and all associated bets?')) return;
        try {
            await DeleteStream(id);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete stream');
        }
    };

    return (
        <div className="page-container">
          <div className="page-content">
            <div className="page-header">
                <Group>
                    <Title order={3}>Live Streams</Title>
                    <Badge>{streams.length}</Badge>
                </Group>
                <Group>
                    <TextInput
                        placeholder="Search by server hash or client seed"
                        leftSection={<IconSearch size={16} />}
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                        style={{ minWidth: 320 }}
                    />
                    <Group>
                        <Switch
                            checked={autoFollow}
                            onChange={(e) => setAutoFollow(e.currentTarget.checked)}
                            label="Auto-follow latest"
                        />
                        <ActionIcon onClick={load} title="Refresh">
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Group>
                </Group>
            </div>

            {error && (
                <Text c="red" size="sm">
                    {error}
                </Text>
            )}

            {loading ? (
                <Group align="center" gap="xs">
                    <Loader size="sm" />
                    <Text c="dimmed">Loading streams…</Text>
                </Group>
            ) : filtered.length === 0 ? (
                <Card>
                    <Text c="dimmed">No streams yet. Point Antebot to the ingest URL and start betting.</Text>
                </Card>
            ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {filtered.map((s) => (
                        <StreamCard key={s.id} s={s} apiBase={apiBase} onDelete={onDelete} />
                    ))}
                </SimpleGrid>
            )}
          </div>
        </div>
    );
}

function StreamCard({
    s,
    apiBase,
    onDelete,
}: {
    s: ReturnType<typeof normalizeStream>;
    apiBase: string;
    onDelete: (id: string) => void;
}) {
    const navigate = useNavigate();
    const shortHash = s.serverSeedHashed
        ? `${s.serverSeedHashed.slice(0, 10)}…`
        : '—';
    const created = s.createdAt ? new Date(s.createdAt).toLocaleString() : '—';
    const lastSeen = s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '—';

    return (
        <Card className="enhanced-card">
            <Stack>
                <Group justify="space-between" align="center">
                    <Group>
                        <Badge>Seed</Badge>
                        <Tooltip label={s.serverSeedHashed || 'n/a'}>
                            <Text fw={600}>{shortHash}</Text>
                        </Tooltip>
                        {s.clientSeed && (
                            <>
                                <Badge>Client</Badge>
                                <Text>{s.clientSeed}</Text>
                            </>
                        )}
                    </Group>
                    <Group>
                        {apiBase && (
                            <Tooltip label="Export CSV">
                                <ActionIcon
                                    onClick={() =>
                                        window.open(
                                            `${apiBase}/live/streams/${s.id}/export.csv`,
                                            '_blank',
                                        )
                                    }
                                >
                                    <IconDownload size={18} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        <Tooltip label="Delete stream">
                            <ActionIcon
                                color="red"
                                onClick={() => onDelete(s.id)}
                            >
                                <IconTrash size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                <Group wrap="wrap">
                    <Stack gap={2}>
                        <Text c="dimmed" size="sm">
                            Created
                        </Text>
                        <Text className="mono">{created}</Text>
                    </Stack>
                    <Stack gap={2}>
                        <Text c="dimmed" size="sm">
                            Last seen
                        </Text>
                        <Text className="mono">{lastSeen}</Text>
                    </Stack>
                    <Stack gap={2}>
                        <Text c="dimmed" size="sm">
                            Total bets
                        </Text>
                        <Text>{s.totalBets ?? '—'}</Text>
                    </Stack>
                    <Stack gap={2}>
                        <Text c="dimmed" size="sm">
                            Highest ×
                        </Text>
                        <Text>{s.highestRoundResult?.toLocaleString() ?? '—'}</Text>
                    </Stack>
                </Group>

                {s.notes && (
                    <Box>
                        <Text c="dimmed" size="sm">
                            Notes
                        </Text>
                        <Text lineClamp={3}>{s.notes}</Text>
                    </Box>
                )}

                <Group justify="space-between" align="center">
                    <Button
                        rightSection={<IconArrowRight size={16} />}
                        onClick={() => navigate(`/live/${s.id}`)}
                    >
                        Open
                    </Button>
                    <Text c="dimmed" size="sm">
                        ID: <span className="mono">{s.id}</span>
                    </Text>
                </Group>
            </Stack>
        </Card>
    );
}