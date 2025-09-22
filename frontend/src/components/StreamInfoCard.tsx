import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconHash,
  IconKey,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import classes from './StreamInfoCard.module.css';

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
  const notesDirty = notes !== (summary.notes ?? '');

  // Keyboard shortcuts
  useHotkeys([
    ['mod+S', () => {
      if (editing && notesDirty) {
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

  useEffect(() => {
    setNotes(summary.notes ?? '');
  }, [summary.notes]);

  const created = useMemo(
    () => new Date(summary.createdAt).toLocaleString(),
    [summary.createdAt],
  );
  const lastSeen = useMemo(
    () => new Date(summary.lastSeenAt).toLocaleString(),
    [summary.lastSeenAt],
  );

  const stats = useMemo(
    () => [
      { label: 'Created', value: created },
      { label: 'Last seen', value: lastSeen },
      {
        label: 'Total bets',
        value:
          summary.totalBets != null ? summary.totalBets.toLocaleString() : '—',
      },
      {
        label: 'Highest ×',
        value:
          summary.highestMultiplier != null
            ? summary.highestMultiplier.toLocaleString()
            : '—',
      },
    ],
    [created, lastSeen, summary.totalBets, summary.highestMultiplier],
  );

  return (
    <Card withBorder radius="lg" shadow="sm" p="lg" className={classes.card}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" className={classes.header} wrap="wrap">
          <Group gap="sm" className={classes.heading}>
            <IconHash size={18} />
            <Stack gap={0}>
              <Text fw={600}>Stream Information</Text>
              <Text size="sm" c="dimmed">
                Overview, exports, and notes
              </Text>
            </Stack>
          </Group>
          <Group gap="sm" className={classes.actions} wrap="wrap">
            <Button
              variant="light"
              color="violet"
              onClick={onExportCsv}
              leftSection={<IconDownload size={16} />}
            >
              Export CSV
            </Button>
            <Button
              color="red"
              variant="light"
              loading={!!isDeletingStream}
              onClick={onDeleteStream}
              leftSection={<IconTrash size={16} />}
            >
              Delete Stream
            </Button>
          </Group>
        </Group>

        <div className={classes.seeds}>
          <div className={classes.seedCard}>
            <Text className={classes.seedLabel}>Server Seed Hash</Text>
            <Group justify="space-between" align="center" gap="sm">
              <Text className={classes.seedValue} lineClamp={2}>
                {summary.serverSeedHashed || '—'}
              </Text>
              {summary.serverSeedHashed && (
                <CopyButton value={summary.serverSeedHashed} timeout={1500}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy hash'}>
                      <ActionIcon
                        size="sm"
                        variant={copied ? 'filled' : 'light'}
                        color={copied ? 'teal' : 'indigo'}
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              )}
            </Group>
          </div>
          <div className={classes.seedCard}>
            <Text className={classes.seedLabel}>Client Seed</Text>
            <Group justify="space-between" align="center" gap="sm">
              <Text className={classes.seedValue} lineClamp={2}>
                {summary.clientSeed || '—'}
              </Text>
              {summary.clientSeed && (
                <CopyButton value={summary.clientSeed} timeout={1500}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy client seed'}>
                      <ActionIcon
                        size="sm"
                        variant={copied ? 'filled' : 'light'}
                        color={copied ? 'teal' : 'indigo'}
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              )}
            </Group>
          </div>
        </div>

        <div className={classes.statsGrid}>
          {stats.map((stat) => (
            <div className={classes.stat} key={stat.label}>
              <Text className={classes.statLabel}>{stat.label}</Text>
              <Text className={classes.statValue}>{stat.value}</Text>
            </div>
          ))}
        </div>

        <div className={classes.notesSection}>
          <Group gap="xs" className={classes.notesLabel}>
            <IconKey size={16} />
            <Text fw={600}>Notes</Text>
            {notesDirty && editing && (
              <Badge size="xs" color="yellow" variant="light">
                Unsaved changes
              </Badge>
            )}
          </Group>
          <Textarea
            className={classes.notesInput}
            minRows={3}
            autosize
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            readOnly={!editing}
            variant="filled"
          />
          <Group gap="sm" className={classes.notesActions} wrap="wrap">
            {!editing ? (
              <Button onClick={() => setEditing(true)} variant="light" color="indigo">
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
                  disabled={!notesDirty}
                >
                  Save
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setNotes(summary.notes ?? '');
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </Group>
        </div>
      </Stack>
    </Card>
  );
}
