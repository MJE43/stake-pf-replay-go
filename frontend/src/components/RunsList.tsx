import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconHistory,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ListRuns } from '../../wailsjs/go/bindings/App';
import { bindings } from '../../wailsjs/go/models';
import { RunsTable } from './RunsTable';
import { callWithRetry, waitForWailsBinding } from '../lib/wails';

export function RunsList() {
  const navigate = useNavigate();
  const [runsData, setRunsData] = useState<bindings.RunsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<bindings.RunsQuery>({
    page: 1,
    perPage: 25,
    game: undefined,
  });

  const fetchRuns = async (query: bindings.RunsQuery) => {
    try {
      setLoading(true);
      setError(null);
      await waitForWailsBinding(['go', 'bindings', 'App', 'ListRuns'], { timeoutMs: 10_000 });
      const result = await callWithRetry(() => ListRuns(query), 4, 250);
      setRunsData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load runs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns(currentQuery);
  }, [currentQuery]);

  const handleQueryChange = (patch: Partial<bindings.RunsQuery>) => {
    setCurrentQuery((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? 1,
    }));
  };

  const refresh = () => fetchRuns(currentQuery);

  const totalPages = useMemo(() => {
    if (!runsData?.totalCount || !currentQuery.perPage) return 1;
    return Math.max(1, Math.ceil(runsData.totalCount / currentQuery.perPage));
  }, [runsData?.totalCount, currentQuery.perPage]);

  const header = (
    <div className="page-header">
      <div>
        <Group gap="xs" mb="xs">
          <IconHistory size={24} color="var(--mantine-color-indigo-6)" />
          <Title order={2} c="dark.6">
            Scan History
          </Title>
        </Group>
        <Text c="dimmed" size="sm">
          View and manage your previous scan results
        </Text>
      </div>
      <Group gap="sm">
        <Button
          variant="subtle"
          leftSection={<IconRefresh size={16} />}
          onClick={refresh}
          loading={loading}
        >
          Refresh
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          className="btn-gradient"
          onClick={() => navigate('/')}
        >
          New Scan
        </Button>
      </Group>
    </div>
  );

  if (error) {
    return (
      <div className="page-container">
        <div className="page-content">
          {header}
          <Alert icon={<IconAlertCircle size={16} />} title="Error loading scan history" color="red" radius="md">
            {error}
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {header}

        {runsData && runsData.totalCount !== undefined && (
          <Paper shadow="sm" radius="md" className="fade-in">
            <Group justify="space-between" align="center">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Total scans
                </Text>
                <Text size="xl" fw={700} c="indigo.7">
                  {runsData.totalCount.toLocaleString()}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Current page
                </Text>
                <Text size="xl" fw={700} c="indigo.7">
                  {currentQuery.page} of {totalPages}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Rows per page
                </Text>
                <Text size="xl" fw={700} c="indigo.7">
                  {currentQuery.perPage}
                </Text>
              </Box>
              {currentQuery.game && (
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    Filter
                  </Text>
                  <Badge color="indigo" variant="light" size="lg">
                    {currentQuery.game.toUpperCase()}
                  </Badge>
                </Box>
              )}
            </Group>
          </Paper>
        )}

        <Box pos="relative">
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

          {!loading && runsData && runsData.runs && runsData.runs.length === 0 ? (
            <Paper radius="lg" ta="center" className="card-hover">
              <Stack gap="md" align="center">
                <IconHistory size={42} color="var(--mantine-color-gray-4)" />
                <div>
                  <Title order={3} c="gray.7">
                    No scan history yet
                  </Title>
                  <Text c="dimmed" size="sm">
                    You haven't run any scans. Start by creating your first scan.
                  </Text>
                </div>
                <Button
                  leftSection={<IconPlus size={16} />}
                  className="btn-gradient"
                  onClick={() => navigate('/')}
                >
                  Create first scan
                </Button>
              </Stack>
            </Paper>
          ) : !loading && runsData && runsData.runs ? (
            <RunsTable data={runsData} query={currentQuery} onQueryChange={handleQueryChange} />
          ) : null}
        </Box>
      </div>
    </div>
  );
}
