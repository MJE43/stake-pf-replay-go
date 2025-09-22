import { Group, Text, Title } from '@mantine/core';
import { IconScan } from '@tabler/icons-react';
import { ScanForm } from '../components';

export function ScanPage() {
  return (
    <div className="page-container">
      <div className="page-content">
        <div className="page-header">
          <div>
            <Group gap="xs" mb="xs">
              <IconScan size={24} color="var(--mantine-color-indigo-6)" />
              <Title order={2} c="dark.6">
                New Scan
              </Title>
            </Group>
            <Text c="dimmed" size="sm">
              Configure your provable fairness scan parameters to analyze game outcomes
            </Text>
          </div>
        </div>
        <ScanForm />
      </div>
    </div>
  );
}
