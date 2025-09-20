import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Layout, ErrorBoundary } from './components';
import { ScanPage, RunsPage, RunDetailsPage } from './pages';
import { theme } from './theme';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import "mantine-react-table/styles.css";
import './styles/global.css';

function App() {
  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <ErrorBoundary>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<ScanPage />} />
              <Route path="/runs" element={<RunsPage />} />
              <Route path="/runs/:id" element={<RunDetailsPage />} />
            </Routes>
          </Layout>
        </Router>
      </ErrorBoundary>
    </MantineProvider>
  );
}

export default App;
