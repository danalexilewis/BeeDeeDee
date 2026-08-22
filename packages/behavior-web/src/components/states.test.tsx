import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { toApiError } from '@/api/client';
import { EmptyState, ErrorState, LoadingState } from './states';

describe('LoadingState', () => {
  test('announces itself politely to assistive technology', async () => {
    const screen = await render(<LoadingState />);
    const status = screen.getByRole('status');
    await expect.element(status).toBeVisible();
    await expect.element(status).toHaveAttribute('aria-live', 'polite');
  });

  test('accepts a custom label', async () => {
    const screen = await render(<LoadingState label="Loading catalog" />);
    await expect.element(screen.getByText('Loading catalog')).toBeVisible();
  });
});

describe('EmptyState', () => {
  test('shows a title and description', async () => {
    const screen = await render(
      <EmptyState title="Nothing here" description="Try clearing the filter." />
    );
    await expect.element(screen.getByText('Nothing here')).toBeVisible();
    await expect.element(screen.getByText('Try clearing the filter.')).toBeVisible();
  });

  test('works without a description', async () => {
    const screen = await render(<EmptyState title="Nothing here" />);
    await expect.element(screen.getByText('Nothing here')).toBeVisible();
  });
});

describe('ErrorState', () => {
  test('renders a failure as an alert', async () => {
    const screen = await render(<ErrorState error={new Error('Boom')} />);
    const alert = screen.getByRole('alert');
    await expect.element(alert).toBeVisible();
    await expect.element(screen.getByText('Boom')).toBeVisible();
  });

  test('treats a 503 as indexing in progress rather than a fault', async () => {
    // The first scan not having finished is a normal startup state, so it must
    // not read as an error the user needs to act on.
    const screen = await render(
      <ErrorState error={toApiError(503, { tag: 'IndexNotReady', message: 'not ready' })} />
    );

    await expect.element(screen.getByRole('status')).toBeVisible();
    await expect.element(screen.getByText(/Indexing your specifications/)).toBeVisible();
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });

  test('falls back to a generic message for a non-Error value', async () => {
    const screen = await render(<ErrorState error={'just a string'} />);
    await expect.element(screen.getByText('Something went wrong')).toBeVisible();
  });
});
