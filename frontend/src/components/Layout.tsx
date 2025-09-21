import { ReactNode } from 'react';
import { AppShell, Text, NavLink, Group, Title, Badge, Box, Divider, Stack } from '@mantine/core';
import { IconScan, IconHistory, IconChartBar, IconShield, IconCpu, IconBroadcast } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      icon: IconScan,
      label: 'New Scan',
      path: '/',
      description: 'Configure and start a new scan',
    },
    {
      icon: IconHistory,
      label: 'Scan History',
      path: '/runs',
      description: 'View previous scan results',
    },
    {
      icon: IconBroadcast,
      label: 'Live Streams',
      path: '/live',
      description: 'Monitor live betting streams',
    },
  ];

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: 'sm',
      }}
      header={{ height: 70 }}
      padding="lg"
      styles={{
        main: {
          backgroundColor: 'var(--mantine-color-gray-0)',
          minHeight: '100vh',
        },
        navbar: {
          backgroundColor: 'var(--mantine-color-dark-8)',
          borderRight: '1px solid var(--mantine-color-dark-4)',
        },
        header: {
          backgroundColor: 'var(--mantine-color-white)',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <Box
              p="xs"
              style={{
                backgroundColor: 'var(--mantine-color-blue-6)',
                borderRadius: 'var(--mantine-radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconChartBar size={24} color="white" />
            </Box>
            <div>
              <Title order={2} c="dark.8" fw={700}>
                Stake PF Replay
              </Title>
              <Text size="sm" c="dimmed">
                Provable Fairness Analysis Tool
              </Text>
            </div>
          </Group>
          
          <Group gap="xs">
            <Badge
              variant="light"
              color="green"
              leftSection={<IconShield size={12} />}
              size="sm"
            >
              Local Only
            </Badge>
            <Badge
              variant="light"
              color="blue"
              leftSection={<IconCpu size={12} />}
              size="sm"
            >
              High Performance
            </Badge>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="lg">
        <Stack gap="lg">
          {/* Navigation Header */}
          <Box>
            <Text size="xs" tt="uppercase" fw={700} c="gray.5" mb="md" pl="xs">
              Navigation
            </Text>
            <Divider color="dark.4" />
          </Box>

          {/* Navigation Items */}
          <Stack gap="xs">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                active={location.pathname === item.path}
                label={item.label}
                description={item.description}
                leftSection={<item.icon size="1.2rem" stroke={1.5} />}
                onClick={() => navigate(item.path)}
                styles={{
                  root: {
                    borderRadius: 'var(--mantine-radius-md)',
                    padding: 'var(--mantine-spacing-md)',
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-dark-6)',
                    },
                    '&[data-active]': {
                      backgroundColor: 'var(--mantine-color-blue-9)',
                      '&:hover': {
                        backgroundColor: 'var(--mantine-color-blue-8)',
                      },
                    },
                  },
                  label: {
                    color: 'var(--mantine-color-gray-1)',
                    fontWeight: 500,
                    fontSize: 'var(--mantine-font-size-sm)',
                  },
                  description: {
                    color: 'var(--mantine-color-gray-4)',
                    fontSize: 'var(--mantine-font-size-xs)',
                  },
                  section: {
                    color: 'var(--mantine-color-gray-3)',
                  },
                }}
              />
            ))}
          </Stack>

          {/* Footer Info */}
          <Box mt="auto" pt="lg">
            <Divider color="dark.4" mb="md" />
            <Text size="xs" c="gray.5" ta="center">
              Desktop Application
            </Text>
            <Text size="xs" c="gray.6" ta="center" mt="xs">
              Your seeds never leave this device
            </Text>
          </Box>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'var(--mantine-spacing-md)',
          }}
        >
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}