import { useState, useEffect } from 'react';
import { Container, Title, Paper, LoadingOverlay, Alert, Stack, Box, Text, Group, Badge, Button } from '@mantine/core';
import { IconAlertCircle, IconHistory, IconRefresh, IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ListRuns } from '../../wailsjs/go/bindings/App';
import { bindings } from '../../wailsjs/go/models';
import { RunsTable } from './RunsTable';

export function RunsList() {
  const navigate = useNavigate();
  const [runsData, setRunsData] = useState<bindings.RunsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<bindings.RunsQuery>({
    page: 1,
    perPage: 25,
    game: undefined
  });

  const fetchRuns = async (query: bindings.RunsQuery) => {
    try {
      setLoading(true);
      setError(null);
      const result = await ListRuns(query);
      setRunsData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns(currentQuery);
  }, [currentQuery]);

  const handleQueryChange = (newQuery: Partial<bindings.RunsQuery>) => {
    setCurrentQuery(prev => ({
      ...prev,
      ...newQuery,
      // Reset to page 1 when changing filters
      page: newQuery.page ?? 1
    }));
  };

  const handleRefresh = () => {
    fetchRuns(currentQuery);
  };

  if (error) {
    return (
      <Container size="xl" className="fade-in">
        <Stack gap="lg">
          {/* Header */}
          <Box>
            <Group justify="space-between" align="flex-start" mb="lg">
              <Box>
                <Title order={2} className="text-gradient" mb="xs">
                  Scan History
                </Title>
                <Text c="dimmed" size="sm">
                  View and manage your previous scan results
                </Text>
              </Box>
              
              <Group gap="md">
                <Button
                  leftSection={<IconRefresh size={16} />}
                  variant="light"
                  onClick={handleRefresh}
                >
                  Refresh
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/')}
                  className="btn-gradient"
                >
                  New Scan
                </Button>
              </Group>
            </Group>
          </Box>

          <Alert
            icon={<IconAlertCircle size="1.2rem" />}
            title="Error Loading Scan History"
            color="red"
            radius="md"
            className="card-hover"
          >
            {error}
          </Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" className="fade-in">
      <Stack gap="xl">
        {/* Header Section */}
        <Box>
          <Group justify="space-between" align="flex-start" mb="lg">
            <Box>
              <Group gap="xs" mb="xs">
                <IconHistory size={24} color="var(--mantine-color-blue-6)" />
                <Title order={2} className="text-gradient">
                  Scan History
                </Title>
              </Group>
              <Text c="dimmed" size="sm">
                View and manage your previous scan results
              </Text>
            </Box>
            
            <Group gap="md">
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                onClick={handleRefresh}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate('/')}
                className="btn-gradient"
              >
                New Scan
              </Button>
            </Group>
          </Group>

          {/* Stats Summary */}
          {runsData && runsData.totalCount !== undefined && (
            <Paper p="md" bg="blue.0" withBorder radius="md" className="fade-in">
              <Group justify="space-around" ta="center">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Scans</Text>
                  <Text size="xl" fw={700} c="blue.8">{runsData.totalCount.toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Current Page</Text>
                  <Text size="xl" fw={700} c="blue.8">
                    {currentQuery.page} of {Math.ceil(runsData.totalCount / (currentQuery.perPage || 25))}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Per Page</Text>
                  <Text size="xl" fw={700} c="blue.8">{currentQuery.perPage}</Text>
                </Box>
                {currentQuery.game && (
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Filtered by</Text>
                    <Badge variant="filled" color="blue" size="lg" mt={4}>
                      {currentQuery.game.toUpperCase()}
                    </Badge>
                  </Box>
                )}
              </Group>
            </Paper>
          )}
        </Box>

        {/* Main Content */}
        <Box style={{ position: 'relative' }}>
          <LoadingOverlay 
            visible={loading} 
            overlayProps={{ blur: 2 }}
            loaderProps={{ size: 'lg', type: 'dots' }}
          />
          
          {!loading && runsData && runsData.runs && runsData.runs.length === 0 ? (
            <Paper p="xl" withBorder radius="lg" ta="center" className="card-hover">
              <IconHistory size={48} color="var(--mantine-color-gray-5)" style={{ marginBottom: 16 }} />
              <Title order={3} c="gray.6" mb="xs">No Scan History</Title>
              <Text c="dimmed" mb="lg">
                You haven't run any scans yet. Start by creating your first scan.
              </Text>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate('/')}
                className="btn-gradient"
              >
                Create First Scan
              </Button>
            </Paper>
          ) : !loading && runsData && runsData.runs ? (
            <RunsTable
              data={runsData}
              query={currentQuery}
              onQueryChange={handleQueryChange}
            />
          ) : null}
        </Box>
      </Stack>
    </Container>
  );
}