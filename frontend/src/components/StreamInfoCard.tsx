import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useClipboard, useHotkeys } from '@mantine/hooks';
import {
  IconCheck,
  IconCopy,
  IconHash,
  IconKey,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

export type StreamSummary = {
  id: string;
  serverSeedHashed: string;
  clientSeed: string;
  createdAt: string;     // ISO
  lastSeenAt: string;    // ISO
  notes: string;
  totalBets?: number;
  highestMultiplier?: number;
};

export default function StreamInfoCard(props: {
  summary: StreamSummary;
  onSaveNotes: (notes: string) => void;
  onExportCsv: () => void;
  onDeleteStream: () => void;
  isSavingNotes?: boolean;
  isDeletingStream?: boolean;
}) {
  const {
    summary,
    onSaveNotes,
    onExportCsv,
    onDeleteStream,
    isSavingNotes,
    isDeletingStream,
  } = props;

  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(summary.notes ?? '');
  const clip = useClipboard({ timeout: 1500 });

  // Keyboard shortcuts
  useHotkeys([
    ['mod+S', () => {
      if (editing) {
        onSaveNotes(notes);
        setEditing(false);
      }
    }],
    ['Escape', () => {
      if (editing) {
        setNotes(summary.notes ?? '');
        setEditing(false);
      }
    }],
  ]);

  const created = useMemo(
    () => new Date(summary.createdAt).toLocaleString(),
    [summary.createdAt],
  );
  const lastSeen = useMemo(
    () => new Date(summary.lastSeenAt).toLocaleString(),
    [summary.lastSeenAt],
  );

  const hashShort = useMemo(
    () =>
      summary.serverSeedHashed
        ? `${summary.serverSeedHashed.slice(0, 10)}…`
        : '—',
    [summary.serverSeedHashed],
  );

  return (
    <Card withBorder radius="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconHash size={16} />
            <Text fw={600}>Stream Information</Text>
          </Group>
          <Group gap="xs">
            <Button variant="light" onClick={onExportCsv}>
              Export CSV
            </Button>
            <Button
              color="red"
              variant="light"
              loading={!!isDeletingStream}
              onClick={onDeleteStream}
              leftSection={<IconTrash size={16} />}
            >
              Delete
            </Button>
          </Group>
        </Group>

        <Group wrap="wrap" gap="lg">
          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              Server Seed Hash
            </Text>
            <Group gap="xs">
              <Badge variant="light">{hashShort}</Badge>
              {summary.serverSeedHashed && (
                <Tooltip label="Copy full hash">
                  <ActionIcon
                    variant="subtle"
                    onClick={() => clip.copy(summary.serverSeedHashed)}
                  >
                    {clip.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Stack>

          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              Client Seed
            </Text>
            <Group gap="xs">
              <Badge variant="light">{summary.clientSeed || '—'}</Badge>
              {summary.clientSeed && (
                <Tooltip label="Copy client seed">
                  <ActionIcon
                    variant="subtle"
                    onClick={() => clip.copy(summary.clientSeed)}
                  >
                    {clip.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Stack>

          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              Created
            </Text>
            <Text style={{ fontFamily: 'ui-monospace' }}>{created}</Text>
          </Stack>

          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              Last Seen
            </Text>
            <Text style={{ fontFamily: 'ui-monospace' }}>{lastSeen}</Text>
          </Stack>

          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              Total Bets
            </Text>
            <Text>{summary.totalBets ?? '—'}</Text>
          </Stack>

          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              Highest ×
            </Text>
            <Text>{summary.highestMultiplier?.toLocaleString() ?? '—'}</Text>
          </Stack>
        </Group>

        <Stack gap="xs">
          <Group gap="xs">
            <IconKey size={16} />
            <Text fw={600}>Notes</Text>
          </Group>
          <Textarea
            minRows={3}
            autosize
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            readOnly={!editing}
          />
          <Group gap="xs">
            {!editing ? (
              <Button variant="light" onClick={() => setEditing(true)}>
                Edit Notes
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    onSaveNotes(notes);
                    setEditing(false);
                  }}
                  loading={!!isSavingNotes}
                >
                  Save
                </Button>
                <Button variant="light" onClick={() => {
                  setNotes(summary.notes ?? '');
                  setEditing(false);
                }}>
                  Cancel
                </Button>
              </>
            )}
          </Group>
        </Stack>
      </Stack>
    </Card>
  );
}