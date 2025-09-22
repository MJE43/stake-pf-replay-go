import { ReactNode } from 'react';
import {
  AppShell,
  Badge,
  Box,
  Group,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBroadcast,
  IconChartBar,
  IconHistory,
  IconScan,
  IconShield,
  IconCpu,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import classes from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    icon: IconScan,
    label: 'New Scan',
    description: 'Configure and start a new scan',
    path: '/',
  },
  {
    icon: IconHistory,
    label: 'Scan History',
    description: 'View previous scan results',
    path: '/runs',
  },
  {
    icon: IconBroadcast,
    label: 'Live Streams',
    description: 'Monitor live betting streams',
    path: '/live',
  },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppShell
      className={classes.shell}
      padding="0"
      header={{ height: 72 }}
      navbar={{ width: 260, breakpoint: 'sm' }}
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <div className={classes.productMark}>
              <IconChartBar size={20} />
            </div>
            <div className={classes.headerTitle}>
              <Title order={3} fw={700} c="dark.7">
                Stake PF Replay
              </Title>
              <Text size="sm" c="gray.6">
                Provable Fairness Analysis Tool
              </Text>
            </div>
          </Group>

          <div className={classes.topBadges}>
            <Badge
              variant="light"
              color="teal"
              leftSection={<IconShield size={12} />}
            >
              Local Only
            </Badge>
            <Badge
              variant="light"
              color="indigo"
              leftSection={<IconCpu size={12} />}
            >
              High Performance
            </Badge>
          </div>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="lg" className={classes.navbar}>
        <Stack h="100%" gap="xl">
          <div>
            <Text className={classes.navSectionTitle}>Navigation</Text>
            <Stack gap="xs">
              {navItems.map((item) => {
                const active = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <UnstyledButton
                    key={item.path}
                    className={clsx(classes.navLink, active && classes.navLinkActive)}
                    onClick={() => navigate(item.path)}
                  >
                    <span className={classes.navLinkIcon}>
                      <item.icon size={18} stroke={1.7} />
                    </span>
                    <div>
                      <Text fw={600} size="sm">
                        {item.label}
                      </Text>
                      <Text size="xs" c="gray.6">
                        {item.description}
                      </Text>
                    </div>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </div>

          <div className={classes.navFooter}>
            <Stack gap="xs">
              <Text size="xs" c="gray.6" fw={600} tt="uppercase">
                Desktop Application
              </Text>
              <Text size="xs" c="gray.5">
                Your seeds never leave this device
              </Text>
            </Stack>
          </div>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <Box component="main">{children}</Box>
      </AppShell.Main>
    </AppShell>
  );
}
