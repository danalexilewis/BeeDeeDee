import { createRouter } from '@tanstack/react-router';
import { Route as catalogRoute } from './routes/catalog';
import { Route as featureRoute } from './routes/feature';
import { Route as problemsRoute } from './routes/problems';
import { Route as rootRoute } from './routes/root';

const routeTree = rootRoute.addChildren([catalogRoute, featureRoute, problemsRoute]);

/** Builds the router. A factory so tests can create an isolated instance. */
export function createAppRouter() {
  return createRouter({ routeTree });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
