import { Component, ReactNode, ErrorInfo } from 'react';
import { Alert, Button, Container, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container size="sm" py="xl">
          <Stack align="center" gap="md">
            <Alert
              icon={<IconAlertTriangle size="1rem" />}
              title="Something went wrong"
              color="red"
              variant="light"
            >
              <Text size="sm" mb="md">
                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
              </Text>
              
              {this.state.error && (
                <Text size="xs" c="dimmed" ff="monospace">
                  {this.state.error.message}
                </Text>
              )}
            </Alert>

            <Button onClick={this.handleReset} variant="outline">
              Try Again
            </Button>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details style={{ whiteSpace: 'pre-wrap', width: '100%' }}>
                <summary>Error Details (Development)</summary>
                <Text size="xs" ff="monospace" mt="sm">
                  {this.state.error && this.state.error.stack}
                  {this.state.errorInfo.componentStack}
                </Text>
              </details>
            )}
          </Stack>
        </Container>
      );
    }

    return this.props.children;
  }
}