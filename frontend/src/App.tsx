import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout, ErrorBoundary } from './components';
import { ScanPage, RunsPage, RunDetailsPage, LiveStreamsPage, LiveStreamDetailPage } from './pages';
import { AppToaster } from '@/components/ui/sonner-toaster';
import './styles/globals.css';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
        <AppToaster />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
