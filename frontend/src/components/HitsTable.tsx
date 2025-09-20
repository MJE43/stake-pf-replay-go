import { useState, useEffect, useMemo } from 'react';
import { Paper, Title, Group, Alert, Text, Box, Badge, Skeleton, Stack, Transition } from '@mantine/core';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import { GetRunHits } from "../../wailsjs/go/bindings/App";
import { store } from "../../wailsjs/go/models";
import { IconTable, IconAlertCircle } from "@tabler/icons-react";

interface HitsTableProps {
  runId: string;
}

export function HitsTable({ runId }: HitsTableProps) {
  const [data, setData] = useState<store.HitWithDelta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch hits data
  const fetchHits = async () => {
    try {
      setLoading(true);
      setError(null);

      const hitsPage = await GetRunHits(runId, 1, 50);
      setData(hitsPage.hits || []);
    } catch (err) {
      console.error("Failed to fetch hits:", err);
      setError(err instanceof Error ? err.message : "Failed to load hits");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchHits();
  }, [runId]);

  // Define columns using the exact MRT v2 pattern
  const columns = useMemo<MRT_ColumnDef<store.HitWithDelta>[]>(
    () => [
      {
        accessorKey: "nonce",
        header: "Nonce",
      },
      {
        accessorKey: "metric",
        header: "Metric",
      },
      {
        accessorKey: "delta_nonce",
        header: "Delta",
      },
    ],
    []
  );

  // Initialize table using the exact MRT v2 pattern
  const table = useMantineReactTable({
    columns,
    data, // must be memoized or stable
  });

  if (error) {
    return (
      <Paper p="xl" withBorder radius="lg" className="glass-effect">
        <Alert
          icon={<IconAlertCircle size="1.2rem" />}
          title="Unable to Load Hits"
          color="red"
          radius="md"
          className="card-hover"
        >
          <Text size="sm">{error}</Text>
        </Alert>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper p="xl" withBorder radius="lg" className="glass-effect card-hover">
        <Group justify="space-between" align="center" mb="xl">
          <Group gap="md">
            <Box p="sm" bg="blue.1" style={{ borderRadius: "12px" }}>
              <IconTable size="1.4rem" color="var(--mantine-color-blue-6)" />
            </Box>
            <Box>
              <Title order={3} className="text-gradient" mb={4}>
                Hit Results
              </Title>
              <Text size="sm" c="dimmed">
                Loading hits...
              </Text>
            </Box>
          </Group>
        </Group>
        <Stack gap="md">
          {Array.from({ length: 5 }).map((_, i) => (
            <Group key={i} justify="space-between">
              <Skeleton height={20} width="30%" />
              <Skeleton height={20} width="25%" />
              <Skeleton height={20} width="25%" />
            </Group>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="xl" withBorder radius="lg" className="glass-effect card-hover">
      {/* Header Section */}
      <Group justify="space-between" align="center" mb="xl">
        <Group gap="md">
          <Box p="sm" bg="blue.1" style={{ borderRadius: "12px" }}>
            <IconTable size="1.4rem" color="var(--mantine-color-blue-6)" />
          </Box>
          <Box>
            <Title order={3} className="text-gradient" mb={4}>
              Hit Results
            </Title>
            <Text size="sm" c="dimmed">
              Detailed breakdown of all matching nonces
            </Text>
          </Box>
        </Group>

        {data.length > 0 && (
          <Badge
            variant="gradient"
            gradient={{ from: "blue", to: "cyan" }}
            size="lg"
            radius="md"
          >
            {data.length.toLocaleString()} hits
          </Badge>
        )}
      </Group>

      {/* Table Section */}
      <Box>
        <MantineReactTable table={table} />
      </Box>
    </Paper>
  );
}
