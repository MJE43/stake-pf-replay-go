import { Component, ReactNode, ErrorInfo } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

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
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-900">
          <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-red-600">
              <IconAlertTriangle size={24} />
              <div>
                <h1 className="text-lg font-semibold">Something went wrong</h1>
                <p className="text-sm text-red-500">An unexpected error occurred.</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Please refresh the page. If the problem persists, capture the details below and send them to support.
            </p>

            {this.state.error && (
              <pre className="mt-4 max-h-40 overflow-y-auto rounded-md bg-slate-900/90 p-4 text-xs text-slate-50">
                {this.state.error.message}
              </pre>
            )}

            <Button onClick={this.handleReset} className="mt-6 w-full">
              Try Again
            </Button>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-slate-500">Error details (development)</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-900/90 p-4 text-slate-50">
                  {this.state.error && this.state.error.stack}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
