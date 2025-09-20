import { Paper, Title, Grid, Text, Badge, Group, Stack, Divider } from '@mantine/core';
import { store } from '../../wailsjs/go/models';
import { IconClock, IconTarget, IconHash, IconDice, IconTrendingUp } from '@tabler/icons-react';

interface RunSummaryProps {
  run: store.Run;
}

export function RunSummary({ run }: RunSummaryProps) {
  // Parse the params JSON safely
  let parsedParams: Record<string, any> = {};
  try {
    parsedParams = JSON.parse(run.params_json);
  } catch (e) {
    console.warn('Failed to parse params JSON:', e);
  }

  // Format the created date
  const createdDate = new Date(run.created_at).toLocaleString();

  // Calculate hit rate
  const hitRate = run.total_evaluated > 0 ? (run.hit_count / run.total_evaluated * 100) : 0;

  // Format numbers with appropriate precision
  const formatNumber = (num: number | undefined, precision = 6) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toFixed(precision);
  };

  const formatInteger = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <Paper p="md" withBorder>
      <Title order={3} mb="md">
        <Group gap="xs">
          <IconTrendingUp size="1.2rem" />
          Scan Summary
        </Group>
      </Title>

      <Grid>
        {/* Scan Parameters */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="sm">
            <Title order={4} size="h5" c="dimmed">Scan Parameters</Title>
            
            <Group gap="xs">
              <IconDice size="1rem" />
              <Text size="sm" fw={500}>Game:</Text>
              <Badge variant="light" color="blue">{run.game}</Badge>
            </Group>

            <Group gap="xs">
              <IconHash size="1rem" />
              <Text size="sm" fw={500}>Server Seed Hash:</Text>
              <Text size="sm" ff="monospace" c="dimmed">
                {run.server_seed_hash.substring(0, 16)}...
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500}>Client Seed:</Text>
              <Text size="sm" ff="monospace">{run.client_seed}</Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500}>Nonce Range:</Text>
              <Text size="sm">
                {formatInteger(run.nonce_start)} - {formatInteger(run.nonce_end)}
              </Text>
            </Group>

            <Group gap="xs">
              <IconTarget size="1rem" />
              <Text size="sm" fw={500}>Target:</Text>
              <Text size="sm">
                {run.target_op} {run.target_val} (±{run.tolerance})
              </Text>
            </Group>

            {Object.keys(parsedParams).length > 0 && (
              <Group gap="xs">
                <Text size="sm" fw={500}>Game Parameters:</Text>
                <Text size="sm" ff="monospace">
                  {JSON.stringify(parsedParams)}
                </Text>
              </Group>
            )}
          </Stack>
        </Grid.Col>

        {/* Execution Metadata */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="sm">
            <Title order={4} size="h5" c="dimmed">Execution Metadata</Title>
            
            <Group gap="xs">
              <IconClock size="1rem" />
              <Text size="sm" fw={500}>Created:</Text>
              <Text size="sm">{createdDate}</Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500}>Engine Version:</Text>
              <Badge variant="outline" size="sm">{run.engine_version}</Badge>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500}>Status:</Text>
              <Badge 
                color={run.timed_out ? 'orange' : 'green'} 
                variant="light"
              >
                {run.timed_out ? 'Timed Out' : 'Completed'}
              </Badge>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500}>Hit Limit:</Text>
              <Text size="sm">{formatInteger(run.hit_limit)}</Text>
            </Group>
          </Stack>
        </Grid.Col>
      </Grid>

      <Divider my="md" />

      {/* Statistics */}
      <Title order={4} size="h5" c="dimmed" mb="sm">Statistics</Title>
      <Grid>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Stack gap={4} align="center">
            <Text size="xl" fw={700} c="blue">
              {formatInteger(run.total_evaluated)}
            </Text>
            <Text size="xs" c="dimmed" ta="center">Total Evaluated</Text>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Stack gap={4} align="center">
            <Text size="xl" fw={700} c="green">
              {formatInteger(run.hit_count)}
            </Text>
            <Text size="xs" c="dimmed" ta="center">Hits Found</Text>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Stack gap={4} align="center">
            <Text size="xl" fw={700} c="orange">
              {hitRate.toFixed(4)}%
            </Text>
            <Text size="xs" c="dimmed" ta="center">Hit Rate</Text>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Stack gap={4} align="center">
            <Text size="xl" fw={700} c="violet">
              {run.summary_count ? formatInteger(run.summary_count) : 'N/A'}
            </Text>
            <Text size="xs" c="dimmed" ta="center">Summary Count</Text>
          </Stack>
        </Grid.Col>

        {(run.summary_min !== undefined || run.summary_max !== undefined || run.summary_sum !== undefined) && (
          <>
            <Grid.Col span={{ base: 4 }}>
              <Stack gap={4} align="center">
                <Text size="lg" fw={600} c="red">
                  {formatNumber(run.summary_min)}
                </Text>
                <Text size="xs" c="dimmed" ta="center">Min Metric</Text>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 4 }}>
              <Stack gap={4} align="center">
                <Text size="lg" fw={600} c="teal">
                  {formatNumber(run.summary_max)}
                </Text>
                <Text size="xs" c="dimmed" ta="center">Max Metric</Text>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 4 }}>
              <Stack gap={4} align="center">
                <Text size="lg" fw={600} c="indigo">
                  {formatNumber(run.summary_sum)}
                </Text>
                <Text size="xs" c="dimmed" ta="center">Sum Metric</Text>
              </Stack>
            </Grid.Col>
          </>
        )}
      </Grid>
    </Paper>
  );
}