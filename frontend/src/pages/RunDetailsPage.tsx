import {
  Container,
  Title,
  Paper,
  LoadingOverlay,
  Alert,
  Stack,
  Box,
  Group,
  Badge,
  Text,
  Button,
  Breadcrumbs,
  Anchor,
} from "@mantine/core";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { GetRun, GetRunHits } from "../../wailsjs/go/bindings/App";
import { store, bindings } from "../../wailsjs/go/models";
import { RunSummary, HitsTable } from "../components";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconEye,
  IconClock,
  IconCheck,
  IconX,
} from "@tabler/icons-react";

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<store.Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Run ID is required");
      setLoading(false);
      return;
    }

    const fetchRun = async () => {
      try {
        setLoading(true);
        setError(null);
        const runData = await GetRun(id);
        setRun(runData);
      } catch (err) {
        console.error("Failed to fetch run:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load run details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRun();
  }, [id]);

  const getStatusBadge = (run: store.Run) => {
    if (run.timed_out) {
      return (
        <Badge
          variant="light"
          color="orange"
          leftSection={<IconClock size={12} />}
          size="lg"
        >
          Timed Out
        </Badge>
      );
    } else if (run.hit_count > 0) {
      return (
        <Badge
          variant="light"
          color="green"
          leftSection={<IconCheck size={12} />}
          size="lg"
        >
          Completed
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="light"
          color="gray"
          leftSection={<IconX size={12} />}
          size="lg"
        >
          No Hits
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <Container size="xl" className="fade-in">
        <Paper
          p="xl"
          withBorder
          pos="relative"
          mih={400}
          className="glass-effect"
        >
          <LoadingOverlay
            visible={loading}
            overlayProps={{ blur: 2 }}
            loaderProps={{ size: "lg", type: "dots" }}
          />
          <Box ta="center" py="xl">
            <Text size="lg" c="dimmed">
              Loading run details...
            </Text>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" className="fade-in">
        <Stack gap="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs>
            <Anchor onClick={() => navigate("/runs")} c="blue">
              Scan History
            </Anchor>
            <Text c="dimmed">Error</Text>
          </Breadcrumbs>

          <Alert
            icon={<IconAlertCircle size="1.2rem" />}
            title="Error Loading Run"
            color="red"
            radius="md"
            className="card-hover"
          >
            {error}
          </Alert>

          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            onClick={() => navigate("/runs")}
          >
            Back to Scan History
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!run) {
    return (
      <Container size="xl" className="fade-in">
        <Stack gap="lg">
          {/* Breadcrumbs */}
          <Breadcrumbs>
            <Anchor onClick={() => navigate("/runs")} c="blue">
              Scan History
            </Anchor>
            <Text c="dimmed">Not Found</Text>
          </Breadcrumbs>

          <Alert
            icon={<IconAlertCircle size="1.2rem" />}
            title="Run Not Found"
            color="yellow"
            radius="md"
            className="card-hover"
          >
            The requested scan run could not be found.
          </Alert>

          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            onClick={() => navigate("/runs")}
          >
            Back to Scan History
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" className="fade-in">
      <Stack gap="xl">
        {/* Header Section */}
        <Box>
          {/* Breadcrumbs */}
          <Breadcrumbs mb="md">
            <Anchor onClick={() => navigate("/runs")} c="blue">
              Scan History
            </Anchor>
            <Text c="dimmed">Run {run.id.slice(0, 8)}...</Text>
          </Breadcrumbs>

          {/* Title and Status */}
          <Group justify="space-between" align="flex-start" mb="lg">
            <Box>
              <Title order={2} className="text-gradient" mb="xs">
                Scan Run Details
              </Title>
              <Text c="dimmed" size="sm">
                Detailed analysis results for scan run {run.id}
              </Text>
            </Box>

            <Group gap="md">
              {getStatusBadge(run)}
              <Badge variant="filled" color="blue" size="lg">
                {run.game.toUpperCase()}
              </Badge>
            </Group>
          </Group>

          {/* Quick Stats */}
          <Paper p="md" bg="blue.0" withBorder radius="md" className="fade-in">
            <Group justify="space-around" ta="center">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Total Hits
                </Text>
                <Text size="xl" fw={700} c="blue.8">
                  {run.hit_count.toLocaleString()}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Evaluated
                </Text>
                <Text size="xl" fw={700} c="blue.8">
                  {run.total_evaluated.toLocaleString()}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Hit Rate
                </Text>
                <Text size="xl" fw={700} c="blue.8">
                  {run.total_evaluated > 0
                    ? ((run.hit_count / run.total_evaluated) * 100).toFixed(3)
                    : "0"}
                  %
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Created
                </Text>
                <Text size="sm" fw={500} c="blue.8">
                  {new Date(run.created_at).toLocaleDateString()}
                </Text>
              </Box>
            </Group>
          </Paper>
        </Box>

        {/* Main Content */}
        <Stack gap="lg">
          <RunSummary run={run} />
          <HitsTable runId={run.id} />
        </Stack>

        {/* Back Button */}
        <Group justify="flex-start">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            onClick={() => navigate("/runs")}
            size="md"
          >
            Back to Scan History
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
