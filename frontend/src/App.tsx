import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { Notifications } from '@mantine/notifications';
import { Layout, ErrorBoundary } from './components';
import { ScanPage, RunsPage, RunDetailsPage, LiveStreamsPage, LiveStreamDetailPage } from './pages';
import classes from './App.module.css';

// Mantine v7 CSS imports (order matters)
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import "mantine-react-table/styles.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <div className={classes.appShell}>
          <Notifications />
          <ErrorBoundary>
            <Router>
              <Layout>
                <Routes>
                  <Route path="/" element={<ScanPage />} />
                  <Route path="/runs" element={<RunsPage />} />
                  <Route path="/runs/:id" element={<RunDetailsPage />} />
                  <Route path="/live" element={<LiveStreamsPage />} />
                  <Route path="/live/:id" element={<LiveStreamDetailPage />} />
                </Routes>
              </Layout>
            </Router>
          </ErrorBoundary>
        </div>
      </MantineProvider>
    </QueryClientProvider>
  );
}
