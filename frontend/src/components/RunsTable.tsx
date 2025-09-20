import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { Badge, Text, Group, Select, ActionIcon, Paper, Box, Tooltip, Progress } from '@mantine/core';
import { IconEye, IconClock, IconCheck, IconX, IconFilter, IconTrendingUp } from '@tabler/icons-react';
import { bindings, store } from '../../wailsjs/go/models';
import 'mantine-react-table/styles.css';


interface RunsTableProps {
  data: bindings.RunsList;
  query: bindings.RunsQuery;
  onQueryChange: (query: Partial<bindings.RunsQuery>) => void;
}

export function RunsTable({ data, query, onQueryChange }: RunsTableProps) {
  const navigate = useNavigate();

  const columns = useMemo<MRT_ColumnDef<store.Run>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Run ID',
        size: 120,
        Cell: ({ cell }) => (
          <Tooltip label={`Full ID: ${cell.getValue<string>()}`}>
            <Text size="sm" c="dark.8" fw={500} style={{ fontFamily: 'monospace' }}>
              {cell.getValue<string>().slice(0, 8)}...
            </Text>
          </Tooltip>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        size: 160,
        Cell: ({ cell }) => {
          const date = new Date(cell.getValue<string>());
          const now = new Date();
          const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
          
          let timeAgo = '';
          if (diffHours < 1) {
            timeAgo = 'Just now';
          } else if (diffHours < 24) {
            timeAgo = `${diffHours}h ago`;
          } else {
            const diffDays = Math.floor(diffHours / 24);
            timeAgo = `${diffDays}d ago`;
          }
          
          return (
            <Box>
              <Text size="sm" fw={500} c="dark.8">
                {date.toLocaleDateString()}
              </Text>
              <Text size="xs" c="gray.6">
                {timeAgo}
              </Text>
            </Box>
          );
        },
      },
      {
        accessorKey: 'game',
        header: 'Game',
        size: 100,
        Cell: ({ cell }) => {
          const game = cell.getValue<string>();
          const gameColors = {
            limbo: 'blue',
            dice: 'green',
            roulette: 'red',
            pump: 'orange',
          };
          
          return (
            <Badge 
              variant="light" 
              size="md"
              color={gameColors[game as keyof typeof gameColors] || 'gray'}
              style={{ textTransform: 'uppercase', fontWeight: 600 }}
            >
              {game}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'nonce_start',
        header: 'Nonce Range',
        size: 180,
        Cell: ({ row }) => {
          const range = row.original.nonce_end - row.original.nonce_start;
          return (
            <Box>
              <Text size="sm" fw={500} c="dark.8">
                {row.original.nonce_start.toLocaleString()} - {row.original.nonce_end.toLocaleString()}
              </Text>
              <Text size="xs" c="gray.6">
                {range.toLocaleString()} nonces
              </Text>
            </Box>
          );
        },
      },
      {
        accessorKey: 'hit_count',
        header: 'Hits',
        size: 100,
        Cell: ({ cell, row }) => {
          const hits = cell.getValue<number>();
          const total = row.original.total_evaluated;
          const percentage = total > 0 ? (hits / total) * 100 : 0;
          
          return (
            <Box>
              <Group gap="xs" align="center">
                <Text size="sm" fw={600} c={hits > 0 ? 'green.7' : 'gray.6'}>
                  {hits.toLocaleString()}
                </Text>
                {hits > 0 && <IconTrendingUp size={14} color="var(--mantine-color-green-6)" />}
              </Group>
              {total > 0 && (
                <Text size="xs" c="gray.6">
                  {percentage.toFixed(3)}%
                </Text>
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: 'total_evaluated',
        header: 'Progress',
        size: 140,
        Cell: ({ cell, row }) => {
          const evaluated = cell.getValue<number>();
          const range = row.original.nonce_end - row.original.nonce_start;
          const progress = range > 0 ? (evaluated / range) * 100 : 0;
          const isComplete = !row.original.timed_out && progress >= 100;
          
          return (
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500} c="dark.8">
                  {evaluated.toLocaleString()}
                </Text>
                <Text size="xs" c="gray.6">
                  {progress.toFixed(1)}%
                </Text>
              </Group>
              <Progress
                value={progress}
                size="sm"
                color={isComplete ? 'green' : row.original.timed_out ? 'orange' : 'blue'}
                radius="sm"
              />
            </Box>
          );
        },
      },
      {
        accessorKey: 'timed_out',
        header: 'Status',
        size: 120,
        Cell: ({ cell, row }) => {
          const timedOut = cell.getValue<boolean>();
          const hitCount = row.original.hit_count;
          
          if (timedOut) {
            return (
              <Badge
                variant="light"
                color="orange"
                leftSection={<IconClock size={12} />}
                size="md"
              >
                Timeout
              </Badge>
            );
          } else if (hitCount > 0) {
            return (
              <Badge
                variant="light"
                color="green"
                leftSection={<IconCheck size={12} />}
                size="md"
              >
                Complete
              </Badge>
            );
          } else {
            return (
              <Badge
                variant="light"
                color="gray"
                leftSection={<IconX size={12} />}
                size="md"
              >
                No Hits
              </Badge>
            );
          }
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 80,
        Cell: ({ row }) => (
          <Tooltip label="View detailed results">
            <ActionIcon
              variant="light"
              color="blue"
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/runs/${row.original.id}`);
              }}
              className="card-hover"
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [navigate]
  );

  const gameOptions = [
    { value: '', label: 'All Games' },
    { value: 'limbo', label: 'Limbo' },
    { value: 'dice', label: 'Dice' },
    { value: 'roulette', label: 'Roulette' },
    { value: 'pump', label: 'Pump' },
  ];

  return (
    <Paper withBorder radius="lg" p="lg" className="card-hover fade-in">
      {/* Filter Section */}
      <Box mb="lg">
        <Group gap="md" align="flex-end">
          <IconFilter size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={600} c="blue.8" size="md">Filters</Text>
        </Group>
        
        <Group mt="md" gap="md">
          <Select
            label="Game Type"
            placeholder="All Games"
            data={gameOptions}
            value={query.game || ''}
            onChange={(value) => onQueryChange({ game: value || undefined })}
            clearable
            size="md"
            style={{ minWidth: 180 }}
            styles={{
              input: { color: 'var(--mantine-color-dark-9)' },
              dropdown: { 
                backgroundColor: 'var(--mantine-color-white)',
              },
              option: {
                color: 'var(--mantine-color-dark-9)',
                '&[data-selected]': {
                  backgroundColor: 'var(--mantine-color-blue-1)',
                  color: 'var(--mantine-color-blue-9)',
                },
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-gray-1)',
                },
              },
            }}
          />
          
          {data.totalCount > 0 && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Total Results</Text>
              <Badge variant="light" color="blue" size="lg">
                {data.totalCount.toLocaleString()} runs
              </Badge>
            </Box>
          )}
        </Group>
      </Box>

      {/* Table */}
      <MantineReactTable
        columns={columns}
        data={data.runs}
        enableRowSelection={false}
        enableColumnOrdering={false}
        enableGlobalFilter={false}
        enableColumnFilters={false}
        enableSorting={true}
        enablePagination={true}
        manualPagination={true}
        rowCount={data.totalCount}
        state={{
          pagination: {
            pageIndex: (query.page || 1) - 1,
            pageSize: query.perPage || 25,
          },
        }}
        onPaginationChange={(updater) => {
          if (typeof updater === 'function') {
            const newPagination = updater({
              pageIndex: (query.page || 1) - 1,
              pageSize: query.perPage || 25,
            });
            onQueryChange({
              page: newPagination.pageIndex + 1,
              perPage: newPagination.pageSize,
            });
          }
        }}
        mantineTableBodyRowProps={({ row }) => ({
          onClick: () => navigate(`/runs/${row.original.id}`),
          style: { 
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          },
          className: 'table-hover',
        })}
        mantineTableProps={{
          striped: true,
          highlightOnHover: true,
          withTableBorder: true,
          withColumnBorders: false,
          style: {
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
            color: 'var(--mantine-color-dark-8)',
          },
        }}
        mantineTableHeadProps={{
          style: {
            backgroundColor: 'var(--mantine-color-gray-0)',
          },
        }}
        mantineTableHeadCellProps={{
          style: {
            fontWeight: 600,
            color: 'var(--mantine-color-dark-8)',
            borderBottom: '2px solid var(--mantine-color-gray-3)',
          },
        }}
        mantineTableBodyCellProps={{
          style: {
            color: 'var(--mantine-color-dark-8)',
          },
        }}
        mantinePaginationProps={{
          showRowsPerPage: true,
          rowsPerPageOptions: ['10', '25', '50', '100'],
          size: 'md',
          style: {
            marginTop: 'var(--mantine-spacing-md)',
          },
        }}
        initialState={{
          density: 'md',
        }}
        mantineLoadingOverlayProps={{
          overlayProps: { blur: 2 },
          loaderProps: { size: 'lg', type: 'dots' },
        }}
      />
    </Paper>
  );
}