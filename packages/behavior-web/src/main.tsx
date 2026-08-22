import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAppRouter } from './router';
import './index.css';

/**
 * Server-sent events invalidate the cache when data actually changes, so polling
 * and refetch-on-focus would only duplicate work.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: function shouldRetry(failureCount, error) {
        // 503 means the first index scan is still running, so retrying is
        // worthwhile. Other failures are not transient.
        const status = (error as { status?: number }).status;
        return status === 503 && failureCount < 5;
      },
      retryDelay: 500,
    },
  },
});

const router = createAppRouter();
const container = document.getElementById('root');

if (container === null) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
