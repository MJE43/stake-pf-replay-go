import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Anchor,
    Badge,
    Box,
    Button,
    Group,
    Loader,
    Stack,
    Text,
    Title,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import StreamInfoCard, { StreamSummary } from '../components/StreamInfoCard';
import LiveBetsTableV2 from '../components/LiveBetsTable';
// Wails event bus (optional, improves freshness of header stats)
// AFTER (from src/pages -> ../../wailsjs/runtime)
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
    GetStream,
    UpdateNotes,
    DeleteStream,
    ExportCSV,
    IngestInfo,
} from '../../wailsjs/go/livehttp/LiveModule';
import { livestore } from '../../wailsjs/go/models';

function normalizeStream(s: livestore.LiveStream) {
    // Convert the number[] ID to a string for easier handling
    const idStr = Array.isArray(s.id) ? s.id.join('-') : String(s.id);

    return {
        id: idStr,
        server_seed_hashed: s.server_seed_hashed ?? '',
        client_seed: s.client_seed ?? '',
        created_at: s.created_at ? new Date(s.created_at).toISOString() : '',
        last_seen_at: s.last_seen_at ? new Date(s.last_seen_at).toISOString() : '',
        notes: s.notes ?? '',
        total_bets: s.total_bets ?? 0,
        highest_round_result: s.highest_result ?? undefined,
    };
}

type StreamDetail = ReturnType<typeof normalizeStream>;

export default function LiveStreamDetailPage(props: { streamId?: string }) {
    const params = useParams();
    const navigate = useNavigate();
    const streamId = props.streamId ?? params.id!;
    const [detail, setDetail] = useState<StreamDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingNotes, setSavingNotes] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [apiBase, setApiBase] = useState<string>(''); // for export links

    // fetch stream detail
    const load = async () => {
        setError(null);
        try {
            const stream = await GetStream(streamId);
            setDetail(normalizeStream(stream));
            setRetryCount(0); // Reset retry count on success
        } catch (e: any) {
            console.error('Failed to load stream:', e);
            if (e?.message?.includes('not found') && retryCount < 3) {
                // Stream might not be fully created yet, retry after a short delay
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    load();
                }, 1000);
                return;
            }
            setError(e?.message || 'Failed to load stream');
        } finally {
            setLoading(false);
        }
    };

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

    useEffect(() => {
        setRetryCount(0); // Reset retry count when streamId changes
        load(); // Initial load
        const off = EventsOn(`live:newrows:${streamId}`, () => {
            load();
        });
        return () => {
            off(); // correct unsubscribe
        };
    }, [streamId]);

    const onExportCsv = async () => {
        try {
            const csvData = await ExportCSV(streamId);
            // Create a blob and download it
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stream-${streamId}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (e: any) {
            Notifications.show({
                title: 'Error',
                message: e?.message || 'Failed to export CSV',
                color: 'red',
            });
        }
    };

    const onSaveNotes = async (notes: string) => {
        setSavingNotes(true);
        try {
            await UpdateNotes(streamId, notes);
            setDetail((d) => (d ? { ...d, notes } : d));
            // Show success notification
            Notifications.show({
                title: 'Success',
                message: 'Notes saved successfully',
                color: 'green',
            });
        } catch (e: any) {
            setError(e?.message || 'Failed to save notes');
            Notifications.show({
                title: 'Error',
                message: e?.message || 'Failed to save notes',
                color: 'red',
            });
        } finally {
            setSavingNotes(false);
        }
    };

    const onDeleteStream = async () => {
        if (!confirm('Delete this stream and all associated bets? This action cannot be undone.')) return;
        setDeleting(true);
        try {
            await DeleteStream(streamId);
            Notifications.show({
                title: 'Success',
                message: 'Stream deleted successfully',
                color: 'green',
            });
            navigate('/live');
        } catch (e: any) {
            setError(e?.message || 'Failed to delete stream');
            Notifications.show({
                title: 'Error',
                message: e?.message || 'Failed to delete stream',
                color: 'red',
            });
        } finally {
            setDeleting(false);
        }
    };

    const summary: StreamSummary | null = useMemo(() => {
        if (!detail) return null;
        return {
            id: detail.id,
            serverSeedHashed: detail.server_seed_hashed,
            clientSeed: detail.client_seed,
            createdAt: detail.created_at,
            lastSeenAt: detail.last_seen_at,
            notes: detail.notes ?? '',
            totalBets: detail.total_bets ?? undefined,
            highestMultiplier: detail.highest_round_result ?? undefined,
        };
    }, [detail]);

    if (loading) {
        return (
            <Stack p="lg" gap="md">
                <Group>
                    <Button
                        leftSection={<IconArrowLeft size={16} />}
                        variant="subtle"
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                </Group>
                <Group align="center" gap="xs">
                    <Loader size="sm" />
                    <Text c="dimmed">
                        Loading stream…
                        {retryCount > 0 && ` (retry ${retryCount}/3)`}
                    </Text>
                </Group>
            </Stack>
        );
    }

    if (error || !detail) {
        return (
            <Stack p="lg" gap="md">
                <Group>
                    <Button
                        leftSection={<IconArrowLeft size={16} />}
                        variant="subtle"
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                </Group>
                <Text c="red">{error ?? 'Stream not found'}</Text>
            </Stack>
        );
    }

    return (
        <div className="page-container">
          <div className="page-content">
            <div className="page-header">
                <Group>
                    <Button
                        leftSection={<IconArrowLeft size={16} />}
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                    <Title order={3}>Live Stream</Title>
                    <Badge>Live</Badge>
                </Group>
                <Group>
                    {apiBase && (
                        <Anchor
                            href={`${apiBase}/live/streams/${detail.id}/export.csv`}
                            target="_blank"
                        >
                            <Group gap={4}>
                                <IconExternalLink size={14} />
                                <Text>Export CSV</Text>
                            </Group>
                        </Anchor>
                    )}
                </Group>
            </div>

            {summary && (
                <StreamInfoCard
                    summary={summary}
                    onSaveNotes={onSaveNotes}
                    onExportCsv={onExportCsv}
                    onDeleteStream={onDeleteStream}
                    isSavingNotes={savingNotes}
                    isDeletingStream={deleting}
                />
            )}

            {/* Live virtualized table with infinite scroll + tail polling */}
            <Box>
                <LiveBetsTableV2
                    streamId={detail.id}
                    pageSize={1000}
                    pollMs={1200}
                    defaultOrder="asc"
                />
            </Box>
          </div>
        </div>
    );
}