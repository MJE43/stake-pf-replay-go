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

const API_BASE = 'http://127.0.0.1:17888';

type StreamDetail = {
    id: string;
    server_seed_hashed: string;
    client_seed: string;
    created_at: string;       // ISO
    last_seen_at: string;     // ISO
    notes?: string;
    total_bets?: number;      // optional aggregate
    highest_round_result?: number; // optional aggregate
};

export default function LiveStreamDetailPage(props: { streamId?: string }) {
    const params = useParams();
    const navigate = useNavigate();
    const streamId = props.streamId ?? params.id!;
    const [detail, setDetail] = useState<StreamDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingNotes, setSavingNotes] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // fetch stream detail
    const load = async () => {
        setError(null);
        try {
            const r = await fetch(`${API_BASE}/live/streams/${streamId}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            setDetail(j as StreamDetail);
        } catch (e: any) {
            setError(e?.message || 'Failed to load stream');
        } finally {
            setLoading(false);
        }
    };

useEffect(() => {
  const off = EventsOn(`live:newrows:${streamId}`, () => {
    load();
  });
  return () => {
    off(); // correct unsubscribe
  };
}, [streamId]);

    const onExportCsv = () => {
        // Use HTTP export endpoint; lets the WebView download directly
        window.open(`${API_BASE}/live/streams/${streamId}/export.csv`, '_blank');
    };

    const onSaveNotes = async (notes: string) => {
        setSavingNotes(true);
        try {
            const r = await fetch(`${API_BASE}/live/streams/${streamId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            if (!r.ok) {
                const errorText = await r.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${r.status}: ${errorText}`);
            }
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
            const r = await fetch(`${API_BASE}/live/streams/${streamId}`, {
                method: 'DELETE',
            });
            if (r.status !== 204) {
                const errorText = await r.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${r.status}: ${errorText}`);
            }
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
                    <Text c="dimmed">Loading stream…</Text>
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
        <Stack p="lg" gap="lg">
            <Group justify="space-between" align="center">
                <Group gap="xs">
                    <Button
                        leftSection={<IconArrowLeft size={16} />}
                        variant="subtle"
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                    <Title order={3}>Live Stream</Title>
                    <Badge variant="light">Live</Badge>
                </Group>
                <Group gap="xs">
                    <Anchor
                        href={`${API_BASE}/live/streams/${detail.id}/export.csv`}
                        target="_blank"
                    >
                        <Group gap={4}>
                            <IconExternalLink size={14} />
                            <Text>Export CSV</Text>
                        </Group>
                    </Anchor>
                </Group>
            </Group>

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
                    apiBase={API_BASE}
                    pageSize={1000}
                    pollMs={1200}
                    defaultOrder="asc"
                />
            </Box>
        </Stack>
    );
}