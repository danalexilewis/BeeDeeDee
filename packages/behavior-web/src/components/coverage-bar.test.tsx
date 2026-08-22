import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { CoverageBar } from './coverage-bar';

describe('CoverageBar', () => {
  test('reports the value to assistive technology', async () => {
    const screen = await render(<CoverageBar value={62} />);
    await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
  });

  test('shows the percentage as text', async () => {
    const screen = await render(<CoverageBar value={62} />);
    await expect.element(screen.getByText('62%')).toBeVisible();
  });

  test.each([
    [-10, '0%'],
    [140, '100%'],
  ])('clamps %i to %s', async (value, expected) => {
    const screen = await render(<CoverageBar value={value} />);
    await expect.element(screen.getByText(expected)).toBeVisible();
  });

  test('sets the fill width from the value, measured in the real layout', async () => {
    // The bar fills its container, so the test must give it one to measure against.
    const screen = await render(
      <div style={{ width: 400 }}>
        <CoverageBar value={40} />
      </div>
    );
    const fill = screen.getByTestId('coverage-fill');
    await expect.element(fill).toBeVisible();

    // A real browser resolves the percentage against the track, which jsdom
    // could not do without mocking layout.
    const fillElement = fill.element() as HTMLElement;
    const trackWidth = (fillElement.parentElement as HTMLElement).getBoundingClientRect().width;
    const fillWidth = fillElement.getBoundingClientRect().width;

    expect(trackWidth).toBeGreaterThan(0);
    expect(fillWidth / trackWidth).toBeCloseTo(0.4, 1);
  });
});
