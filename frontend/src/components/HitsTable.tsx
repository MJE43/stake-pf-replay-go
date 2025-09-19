import { useState, useEffect, useMemo } from 'react';
import { Paper, Title, Group, Alert, Text, Box, Badge, Skeleton, Stack, Transition } from '@mantine/core';
import { MantineReactTable, type MRT_ColumnDef, type MRT_SortingState } from 'mantine-react-table';
import { GetRunHits } from '../../wailsjs/go/bindings/App';
import { store } from '../../wailsjs/go/models';
import { IconTable, IconAlertCircle, IconTrendingUp, IconHash, IconDelta } from '@tabler/icons-react';

interface HitsTableProps {
  runId: string;
}

export function HitsTable({ runId }: HitsTableProps) {
  const [data, setData] = useState<store.HitWithDelta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [sorting, setSorting] = useState<MRT_SortingState>([
    { id: 'nonce', desc: false } // Default sort by nonce ascending
  ]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch hits data with smooth loading states
  const fetchHits = async (page: number, perPage: number) => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert 0-based page index to 1-based for backend
      const backendPage = page + 1;
      const hitsPage = await GetRunHits(runId, backendPage, perPage);
      
      // Add slight delay for smooth transitions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setData(hitsPage.hits || []);
      setTotalCount(hitsPage.totalCount || 0);
      setTotalPages(hitsPage.totalPages || 0);
    } catch (err) {
      console.error('Failed to fetch hits:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hits');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when pagination or sorting changes
  useEffect(() => {
    fetchHits(pagination.pageIndex, pagination.pageSize);
  }, [runId, pagination.pageIndex, pagination.pageSize]);

  // Note: For now, we'll handle sorting client-side since the backend doesn't support it yet
  // In a full implementation, we'd pass sorting parameters to the backend
  const sortedData = useMemo(() => {
    if (!sorting.length) return data;
    
    const sortedArray = [...data];
    const sort = sorting[0];
    
    sortedArray.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sort.id) {
        case 'nonce':
          aValue = a.nonce;
          bValue = b.nonce;
          break;
        case 'metric':
          aValue = a.metric;
          bValue = b.metric;
          break;
        case 'delta_nonce':
          aValue = a.delta_nonce ?? Infinity;
          bValue = b.delta_nonce ?? Infinity;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sort.desc ? 1 : -1;
      if (aValue > bValue) return sort.desc ? -1 : 1;
      return 0;
    });
    
    return sortedArray;
  }, [data, sorting]);

  const columns = useMemo<MRT_ColumnDef<store.HitWithDelta>[]>(() => [
    {
      accessorKey: 'nonce',
      header: 'Nonce',
      size: 140,
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return (
          <Text ff="monospace" size="sm" ta="center" c="dark.8">
            {value.toLocaleString()}
          </Text>
        );
      },
    },
    {
      accessorKey: 'metric',
      header: 'Metric',
      size: 140,
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return (
          <Text ff="monospace" size="sm" ta="center" c="dark.8">
            {value.toFixed(4)}×
          </Text>
        );
      },
    },
    {
      accessorKey: 'delta_nonce',
      header: 'Delta',
      size: 140,
      Cell: ({ cell }) => {
        const value = cell.getValue<number | undefined>();
        return (
          <Text ff="monospace" size="sm" ta="center" c={value !== undefined ? "dark.8" : "dimmed"}>
            {value !== undefined ? value.toLocaleString() : "—"}
          </Text>
        );
      },
    },
  ], []);

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <Stack gap="md">
      <Group justify="space-between">
        <Skeleton height={32} width={200} />
        <Skeleton height={24} width={100} />
      </Group>
      {Array.from({ length: 5 }).map((_, i) => (
        <Group key={i} justify="space-between">
          <Skeleton height={20} width="30%" />
          <Skeleton height={20} width="25%" />
          <Skeleton height={20} width="25%" />
        </Group>
      ))}
    </Stack>
  );

  if (error) {
    return (
      <Transition mounted={true} transition="fade" duration={300}>
        {(styles) => (
          <Paper p="xl" withBorder radius="lg" className="glass-effect" style={styles}>
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
        )}
      </Transition>
    );
  }

  return (
    <Transition mounted={true} transition="slide-up" duration={400}>
      {(styles) => (
        <Paper 
          p="xl" 
          withBorder 
          radius="lg" 
          className="glass-effect card-hover" 
          style={styles}
        >
          {/* Header Section */}
          <Group justify="space-between" align="center" mb="xl">
            <Group gap="md">
              <Box
                p="sm"
                bg="blue.1"
                style={{ borderRadius: '12px' }}
              >
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
            
            {totalCount > 0 && (
              <Badge 
                variant="gradient" 
                gradient={{ from: 'blue', to: 'cyan' }}
                size="lg"
                radius="md"
              >
                {totalCount.toLocaleString()} hits
              </Badge>
            )}
          </Group>

          {/* Table Section */}
          {loading && data.length === 0 ? (
            <LoadingSkeleton />
          ) : (
            <Box className="fade-in">
              <MantineReactTable
                columns={columns}
                data={sortedData}
                enableSorting
                enableColumnFilters={false}
                enableGlobalFilter={false}
                enableDensityToggle={false}
                enableFullScreenToggle={false}
                enableHiding={false}
                enableRowSelection={false}
                enableColumnActions={false}
                manualPagination
                rowCount={totalCount}
                state={{
                  isLoading: loading && data.length > 0,
                  pagination,
                  sorting,
                }}
                onPaginationChange={setPagination}
                onSortingChange={setSorting}
                mantineTableProps={{
                  striped: true,
                  highlightOnHover: true,
                  withTableBorder: true,
                  withColumnBorders: false,
                  style: {
                    backgroundColor: 'white',
                  },
                }}
                mantineTableBodyProps={{
                  style: {
                    backgroundColor: 'white',
                  },
                }}
                mantineTableHeadProps={{
                  style: {
                    backgroundColor: 'var(--mantine-color-gray-1)',
                  },
                }}
                mantineTableBodyCellProps={{
                  style: {
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--mantine-color-gray-3)',
                    backgroundColor: 'white',
                    color: 'var(--mantine-color-dark-8)',
                  },
                }}
                mantineTableHeadCellProps={{
                  style: {
                    padding: '12px 16px',
                    fontWeight: 600,
                    backgroundColor: 'var(--mantine-color-gray-1)',
                    borderBottom: '2px solid var(--mantine-color-gray-4)',
                    color: 'var(--mantine-color-dark-8)',
                    textAlign: 'center',
                  },
                }}
                mantineTableBodyRowProps={({ row }) => ({
                  style: {
                    backgroundColor: 'white',
                    color: 'var(--mantine-color-dark-8)',
                  },
                })}
                mantinePaginationProps={{
                  showRowsPerPage: true,
                  rowsPerPageOptions: ['25', '50', '100', '250', '500'],
                  size: 'md',
                  radius: 'md',
                  style: {
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    borderRadius: '12px',
                  },
                }}
                mantineLoadingOverlayProps={{
                  overlayProps: { blur: 1 },
                  loaderProps: { 
                    size: 'md', 
                    type: 'dots',
                    color: 'blue'
                  },
                }}
                initialState={{
                  density: 'md',
                }}
                renderEmptyRowsFallback={() => (
                  <Box ta="center" py="xl" className="fade-in">
                    <Box
                      p="xl"
                      bg="gray.0"
                      style={{ 
                        borderRadius: '16px',
                        border: '2px dashed var(--mantine-color-gray-3)',
                        margin: '20px'
                      }}
                    >
                      <IconTable size="3rem" color="var(--mantine-color-gray-4)" style={{ marginBottom: '16px' }} />
                      <Text size="lg" c="dimmed" mb="xs" fw={500}>
                        No hits found
                      </Text>
                      <Text size="sm" c="dimmed" maw={400} mx="auto">
                        This scan completed successfully but didn't find any nonces matching your criteria. 
                        Try adjusting your threshold or scanning a different range.
                      </Text>
                    </Box>
                  </Box>
                )}
              />
            </Box>
          )}
        </Paper>
      )}
    </Transition>
  );
}