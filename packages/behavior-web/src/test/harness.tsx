import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { render } from 'vitest-browser-react';

/**
 * A query client with retries and caching off, so a component test observes
 * exactly one fetch per query and failures surface immediately.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

function Providers({ children, client }: { children: ReactNode; client: QueryClient }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Renders a component inside the providers it needs.
 *
 * `render` is asynchronous in vitest-browser-react, so this must be awaited;
 * forgetting to leaves you holding a Promise with no locator methods.
 */
export async function renderWithProviders(ui: ReactElement, client = createTestQueryClient()) {
  const screen = await render(<Providers client={client}>{ui}</Providers>);
  return { client, ...screen };
}
