import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import StreamInfoCard, { StreamSummary } from '../components/StreamInfoCard';
import LiveBetsTableV2 from '../components/LiveBetsTable';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  GetStream,
  UpdateNotes,
  DeleteStream,
  ExportCSV,
  IngestInfo,
} from '../../wailsjs/go/livehttp/LiveModule';
import { livestore } from '../../wailsjs/go/models';
import classes from './LiveStreamDetail.module.css';

function normalizeStream(s: livestore.LiveStream) {
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
  const [apiBase, setApiBase] = useState<string>('');

  const load = useCallback(async (attempt = 0) => {
    let scheduledRetry = false;
    setRetryCount(attempt);
    setLoading(true);
    setError(null);

    try {
      const stream = await GetStream(streamId);
      setDetail(normalizeStream(stream));
      setRetryCount(0);
    } catch (e: any) {
      const message = e?.message || 'Failed to load stream';
      if (message.includes('not found') && attempt < 3) {
        scheduledRetry = true;
        setTimeout(() => load(attempt + 1), 1000);
      } else {
        setError(message);
      }
    } finally {
      if (!scheduledRetry) {
        setLoading(false);
      }
    }
  }, [streamId]);

  useEffect(() => {
    (async () => {
      try {
        const info = await IngestInfo();
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
    setDetail(null);
    setRetryCount(0);
    load();
    const off = EventsOn(`live:newrows:${streamId}`, () => {
      load();
    });
    return () => {
      off();
    };
  }, [streamId, load]);

  const onExportCsv = useCallback(async () => {
    try {
      const exported = await ExportCSV(streamId);
      if (exported.includes('\n') || exported.includes(',')) {
        const blob = new Blob([exported], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `stream-${streamId}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        Notifications.show({
          title: 'Export complete',
          message: 'CSV downloaded',
          color: 'green',
        });
      } else {
        Notifications.show({
          title: 'Export complete',
          message: `CSV written to ${exported}`,
          color: 'green',
        });
      }
    } catch (e: any) {
      Notifications.show({
        title: 'Error',
        message: e?.message || 'Failed to export CSV',
        color: 'red',
      });
    }
  }, [streamId]);

  const onSaveNotes = useCallback(async (notes: string) => {
    setSavingNotes(true);
    try {
      await UpdateNotes(streamId, notes);
      setDetail((current) => (current ? { ...current, notes } : current));
      Notifications.show({
        title: 'Saved',
        message: 'Notes updated',
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
  }, [streamId]);

  const onDeleteStream = useCallback(async () => {
    if (!confirm('Delete this stream and all associated bets? This action cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await DeleteStream(streamId);
      Notifications.show({
        title: 'Deleted',
        message: 'Stream removed successfully',
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
  }, [streamId, navigate]);

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
    } satisfies StreamSummary;
  }, [detail]);

  const retryLabel = retryCount > 0 ? ` (retry ${retryCount}/3)` : '';

  if (loading && !detail) {
    return (
      <Stack className={classes.root} gap="md">
        <Button
          className={classes.backButton}
          variant="subtle"
          size="sm"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <Paper withBorder radius="md" className={classes.statusCard}>
          <Group gap="sm">
            <Loader size="sm" />
            <Text c="dimmed">
              Loading stream…
              {retryLabel}
            </Text>
          </Group>
        </Paper>
      </Stack>
    );
  }

  if (error || !detail) {
    return (
      <Stack className={classes.root} gap="md">
        <Button
          className={classes.backButton}
          variant="subtle"
          size="sm"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <Paper withBorder radius="md" className={classes.statusCard}>
          <Text c="red">{error ?? 'Stream not found'}</Text>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack className={classes.root} gap="lg">
      <Button
        className={classes.backButton}
        variant="subtle"
        size="sm"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => navigate(-1)}
      >
        Back
      </Button>

      <Paper withBorder radius="md" shadow="xs" p="md" className={classes.header}>
        <Group justify="space-between" align="flex-start" className={classes.headerRow}>
          <Stack gap={4} className={classes.streamMeta}>
            <Group gap="xs">
              <Title order={3}>Live Stream</Title>
              <Badge color="green" variant="light">
                Live
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Stream ID:{' '}
              <Text component="span" ff="var(--mantine-font-family-monospace)" fw={500}>
                {detail.id}
              </Text>
            </Text>
          </Stack>
          <Group gap="sm">
            {apiBase && (
              <Anchor
                className={classes.exportAnchor}
                href={`${apiBase}/live/streams/${detail.id}/export.csv`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Group gap={4}>
                  <IconExternalLink size={14} />
                  <Text size="sm">Open CSV endpoint</Text>
                </Group>
              </Anchor>
            )}
          </Group>
        </Group>
      </Paper>

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

      <Paper withBorder radius="md" shadow="xs" p="md" className={classes.tableCard}>
        <LiveBetsTableV2
          streamId={detail.id}
          pageSize={1000}
          pollMs={1200}
          defaultOrder="asc"
        />
      </Paper>
    </Stack>
  );
}
