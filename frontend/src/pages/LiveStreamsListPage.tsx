import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Group,
  Loader,
  Paper,
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
  IconAlertCircle,
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
import { callWithRetry, waitForWailsBinding } from '../lib/wails';

function normalizeStream(s: livestore.LiveStream) {
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
  const [apiBase, setApiBase] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        await waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'IngestInfo'], { timeoutMs: 10_000 });
        const info = await callWithRetry(() => IngestInfo(), 4, 250);
        try {
          const url = new URL(info.url);
          setApiBase(`${url.protocol}//${url.host}`);
        } catch {
          setApiBase('');
        }
      } catch (err) {
        console.warn('Failed to load ingest info', err);
        setApiBase('');
      }
    })();
  }, []);

  const load = async () => {
    try {
      setError(null);
      await waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'ListStreams'], { timeoutMs: 10_000 });
      const rows = await callWithRetry(() => ListStreams(200, 0), 4, 300);
      setStreams(rows.map(normalizeStream));
    } catch (e: any) {
      setError(e?.message || 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    for (const s of streams) {
      const off = EventsOn(`live:newrows:${s.id}`, () => load());
      unsubscribers.push(off);
    }
    return () => {
      unsubscribers.forEach((off) => off());
    };
  }, [streams]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const sorted = [...streams].sort((a, b) => {
      const ta = Date.parse(a.lastSeenAt || a.createdAt || '1970-01-01');
      const tb = Date.parse(b.lastSeenAt || b.createdAt || '1970-01-01');
      return tb - ta;
    });
    if (!q) return sorted;
    return sorted.filter((s) => {
      const hash = s.serverSeedHashed?.toLowerCase() ?? '';
      const client = s.clientSeed?.toLowerCase() ?? '';
      return hash.includes(q) || client.includes(q);
    });
  }, [streams, debouncedSearch]);

  const lastAutoFollowed = useRef<string | null>(null);
  useEffect(() => {
    if (!autoFollow || filtered.length === 0 || loading || error) return;
    const latest = filtered[0];
    if (latest?.id && latest.id !== lastAutoFollowed.current && latest.totalBets > 0) {
      lastAutoFollowed.current = latest.id;
      setTimeout(() => navigate(`/live/${latest.id}`), 120);
    }
  }, [autoFollow, filtered, navigate, loading, error]);

  const onDelete = async (id: string) => {
    if (!confirm('Delete this stream and all associated bets?')) return;
    try {
      await waitForWailsBinding(['go', 'livehttp', 'LiveModule', 'DeleteStream'], { timeoutMs: 10_000 });
      await callWithRetry(() => DeleteStream(id), 3, 250);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete stream');
    }
  };

  const openStream = (id: string) => navigate(`/live/${id}`);

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-header">
          <div>
            <Group gap="xs" mb="xs">
              <Badge variant="light" color="indigo">
                {streams.length}
              </Badge>
              <Title order={2} c="dark.6">
                Live Streams
              </Title>
            </Group>
            <Text c="dimmed" size="sm">
              Monitor active Stake Originals sessions and jump into their live bet feeds.
            </Text>
          </div>
        </div>

        <Paper withBorder radius="md" shadow="sm" className="card-hover">
          <Group justify="space-between" align="center" gap="md">
            <TextInput
              placeholder="Search by server hash or client seed"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 260 }}
            />
            <Group gap="sm" align="center">
              <Switch
                checked={autoFollow}
                onChange={(e) => setAutoFollow(e.currentTarget.checked)}
                label="Auto-follow latest"
              />
              <Tooltip label="Refresh now">
                <ActionIcon variant="light" color="indigo" onClick={load}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Live streams unavailable">
            {error}
          </Alert>
        )}

        {loading ? (
          <Group align="center" gap="xs">
            <Loader size="sm" />
            <Text c="dimmed">Loading streams…</Text>
          </Group>
        ) : filtered.length === 0 ? (
          <Paper radius="md" ta="center" className="card-hover">
            <Stack gap="sm" align="center">
              <Text size="lg" fw={600} c="dark.6">
                No streams yet
              </Text>
              <Text c="dimmed" size="sm">
                Point Antebot to the ingest URL and start betting to populate this list.
              </Text>
            </Stack>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {filtered.map((s) => (
              <StreamCard key={s.id} s={s} apiBase={apiBase} onDelete={onDelete} onOpen={openStream} />
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
  onOpen,
}: {
  s: ReturnType<typeof normalizeStream>;
  apiBase: string;
  onDelete: (id: string) => Promise<void> | void;
  onOpen: (id: string) => void;
}) {
  return (
    <Paper withBorder radius="md" shadow="sm" className="card-hover">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={600} size="sm" c="gray.6">
              Client Seed
            </Text>
            <Text fw={600}>{s.clientSeed || '—'}</Text>
          </div>
          <Group gap="xs">
            <Tooltip label="Export CSV">
              <ActionIcon
                variant="subtle"
                color="indigo"
                component="a"
                href={apiBase ? `${apiBase}/live/streams/${s.id}/export.csv` : undefined}
                target={apiBase ? '_blank' : undefined}
                rel="noopener noreferrer"
                disabled={!apiBase}
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete stream">
              <ActionIcon variant="subtle" color="red" onClick={() => onDelete(s.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            Server seed hash
          </Text>
          <Text size="sm" fw={500}>
            {s.serverSeedHashed ? `${s.serverSeedHashed.slice(0, 16)}…` : '—'}
          </Text>
        </div>

        <Group gap="sm">
          <Badge variant="light" color="indigo">
            {s.totalBets.toLocaleString()} bets
          </Badge>
          {s.highestRoundResult && (
            <Badge variant="light" color="violet">
              Max ×{s.highestRoundResult.toLocaleString()}
            </Badge>
          )}
        </Group>

        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Text size="xs" c="dimmed">
              Last seen
            </Text>
            <Text size="sm" fw={500}>
              {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '—'}
            </Text>
          </Stack>
          <Tooltip label="Open live view">
            <ActionIcon
              size="lg"
              variant="light"
              color="indigo"
              onClick={() => onOpen(s.id)}
            >
              <IconArrowRight size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </Paper>
  );
}
