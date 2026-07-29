import { afterEach, describe, expect, test } from 'vitest';
import { EditorLinks } from './editor-links';
import { anEditorLink } from '@/test/fixtures';
import { renderWithProviders } from '@/test/harness';
import { restoreFetch, stubFetch } from '@/test/stub-fetch';

afterEach(restoreFetch);

const QUERY = { target: 'scenario', id: 'login.successful-login' } as const;

describe('EditorLinks', () => {
  test('renders a link per editor the server returns', async () => {
    stubFetch({
      '/api/editor-links': {
        body: [anEditorLink(), anEditorLink({ editor: 'cursor', url: 'cursor://file/x:5' })],
      },
    });

    const screen = await renderWithProviders(<EditorLinks query={QUERY} />);

    await expect.element(screen.getByRole('link', { name: /vscode/ })).toBeVisible();
    await expect.element(screen.getByRole('link', { name: /cursor/ })).toBeVisible();
  });

  test('points the link at the editor deep link URL', async () => {
    stubFetch({ '/api/editor-links': { body: [anEditorLink()] } });

    const screen = await renderWithProviders(<EditorLinks query={QUERY} />);

    await expect
      .element(screen.getByRole('link', { name: /vscode/ }))
      .toHaveAttribute('href', 'vscode://file//repo/specs/features/login.feature:5');
  });

  test('shows a missing target as disabled rather than hiding it', async () => {
    // Hiding the button would leave the user wondering where it went; disabled
    // with the path in the tooltip tells them the file moved.
    stubFetch({ '/api/editor-links': { body: [anEditorLink({ targetExists: false })] } });

    const screen = await renderWithProviders(<EditorLinks query={QUERY} />);

    await expect.element(screen.getByText('vscode')).toBeVisible();
    expect(screen.container.querySelector('a')).toBeNull();
  });

  test('renders nothing when the server returns no links', async () => {
    stubFetch({ '/api/editor-links': { body: [] } });
    const screen = await renderWithProviders(<EditorLinks query={QUERY} />);

    await expect
      .poll(function noLinks() {
        return screen.container.querySelectorAll('a').length;
      })
      .toBe(0);
  });

  test('renders nothing when the request fails', async () => {
    stubFetch({
      '/api/editor-links': { status: 503, body: { tag: 'IndexNotReady', message: 'not ready' } },
    });

    const screen = await renderWithProviders(<EditorLinks query={QUERY} />);

    await expect
      .poll(function stillEmpty() {
        return screen.container.textContent ?? '';
      })
      .toBe('');
  });
});
