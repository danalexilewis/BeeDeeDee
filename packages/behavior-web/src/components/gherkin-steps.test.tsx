import type { GherkinStep } from '@eddy/behavior-contracts';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { GherkinSteps } from './gherkin-steps';

function step(overrides: Partial<GherkinStep> = {}): GherkinStep {
  return { id: 's1', keyword: 'Given ', text: 'a registered user', line: 6, ...overrides };
}

describe('GherkinSteps', () => {
  test('renders each step with its keyword and text', async () => {
    const screen = await render(
      <GherkinSteps
        steps={[step(), step({ id: 's2', keyword: 'When ', text: 'they sign in', line: 7 })]}
      />
    );

    await expect.element(screen.getByText('Given')).toBeVisible();
    await expect.element(screen.getByText('a registered user')).toBeVisible();
    await expect.element(screen.getByText('When')).toBeVisible();
    await expect.element(screen.getByText('they sign in')).toBeVisible();
  });

  test('shows the line number of each step', async () => {
    const screen = await render(<GherkinSteps steps={[step()]} />);
    await expect.element(screen.getByText(':6')).toBeVisible();
  });

  test('explains an empty scenario rather than rendering nothing', async () => {
    const screen = await render(<GherkinSteps steps={[]} />);
    await expect.element(screen.getByText('This scenario has no steps.')).toBeVisible();
  });

  test('renders a doc string argument', async () => {
    const screen = await render(
      <GherkinSteps
        steps={[step({ argument: { type: 'doc_string', content: 'the payload', line: 7 } })]}
      />
    );
    await expect.element(screen.getByText('the payload')).toBeVisible();
  });

  test('renders a data table argument as a table', async () => {
    const screen = await render(
      <GherkinSteps
        steps={[
          step({
            argument: {
              type: 'table',
              content: { headers: ['name', 'role'], rows: [['ada', 'admin']], line: 7 },
              line: 7,
            },
          }),
        ]}
      />
    );

    await expect.element(screen.getByRole('columnheader', { name: 'name' })).toBeVisible();
    await expect.element(screen.getByRole('cell', { name: 'ada' })).toBeVisible();
    await expect.element(screen.getByRole('cell', { name: 'admin' })).toBeVisible();
  });
});
