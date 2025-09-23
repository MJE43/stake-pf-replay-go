import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout, ErrorBoundary } from './components';
import { AppToaster } from '@/components/ui/sonner-toaster';
import './styles/globals.css';

const ScanPage = lazy(() => import('./pages/ScanPage').then((module) => ({ default: module.ScanPage })));
const RunsPage = lazy(() => import('./pages/RunsPage').then((module) => ({ default: module.RunsPage })));
const RunDetailsPage = lazy(
  () => import('./pages/RunDetailsPage').then((module) => ({ default: module.RunDetailsPage })),
);
const LiveStreamsPage = lazy(
  () => import('./pages/LiveStreamsListPage').then((module) => ({ default: module.default })),
);
const LiveStreamDetailPage = lazy(
  () => import('./pages/LiveStreamDetail').then((module) => ({ default: module.default })),
);

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
            <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
              <Routes>
                <Route path="/" element={<ScanPage />} />
                <Route path="/runs" element={<RunsPage />} />
                <Route path="/runs/:id" element={<RunDetailsPage />} />
                <Route path="/live" element={<LiveStreamsPage />} />
                <Route path="/live/:id" element={<LiveStreamDetailPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </Router>
        <AppToaster />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
