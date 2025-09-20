import { Container, Title } from '@mantine/core';
import { ScanForm } from '../components';

export function ScanPage() {
  return (
    <Container size="md">
      <Title order={2} mb="md">
        New Scan
      </Title>
      <ScanForm />
    </Container>
  );
}