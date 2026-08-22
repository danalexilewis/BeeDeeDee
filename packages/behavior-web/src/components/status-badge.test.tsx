import { expect, test, describe } from 'vitest';
import { render } from 'vitest-browser-react';
import { OutcomeBadge, StatusBadge, outcomeToStatus } from './status-badge';

describe('outcomeToStatus', () => {
  test.each([
    ['pass', 'passing'],
    ['fail', 'failing'],
    ['skipped', 'untested'],
    ['not-run', 'untested'],
  ] as const)('maps %s to %s', (outcome, expected) => {
    expect(outcomeToStatus(outcome)).toBe(expected);
  });
});

describe('StatusBadge', () => {
  test.each([
    ['passing', 'Passing'],
    ['failing', 'Failing'],
    ['untested', 'Untested'],
  ] as const)('labels %s as %s', async (status, label) => {
    const screen = await render(<StatusBadge status={status} />);
    await expect.element(screen.getByText(label)).toBeVisible();
  });

  test('exposes the status as a data attribute for styling and tests', async () => {
    const screen = await render(<StatusBadge status="failing" />);
    await expect
      .element(screen.getByTestId('status-badge'))
      .toHaveAttribute('data-status', 'failing');
  });

  test('accepts an overriding label', async () => {
    const screen = await render(<StatusBadge status="untested" label="Not covered" />);
    await expect.element(screen.getByText('Not covered')).toBeVisible();
  });
});

describe('OutcomeBadge', () => {
  test('shows Skipped rather than collapsing it into Untested', async () => {
    const screen = await render(<OutcomeBadge outcome="skipped" />);
    await expect.element(screen.getByText('Skipped')).toBeVisible();
  });

  test('reports a flaky scenario as flaky regardless of the latest outcome', async () => {
    const screen = await render(<OutcomeBadge outcome="pass" flaky />);
    await expect.element(screen.getByText('Flaky')).toBeVisible();
  });

  test('shows Passing for a passing outcome', async () => {
    const screen = await render(<OutcomeBadge outcome="pass" />);
    await expect.element(screen.getByText('Passing')).toBeVisible();
  });
});
