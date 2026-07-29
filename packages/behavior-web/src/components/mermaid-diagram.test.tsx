import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { MermaidDiagram } from './mermaid-diagram';

describe('MermaidDiagram', () => {
  test('renders valid Mermaid source to inline SVG', async () => {
    // This is the case that justifies browser mode: Mermaid measures text to lay
    // out a graph, which needs a real layout engine.
    const screen = await render(
      <MermaidDiagram id="ok" source={'flowchart TD\n  user --> dashboard\n'} />
    );

    const container = screen.getByTestId('mermaid-diagram');
    await expect.element(container).toBeVisible();

    await expect
      .poll(function svgPresent() {
        return container.element().querySelector('svg') !== null;
      })
      .toBe(true);
  });

  test('keeps the source readable when the diagram cannot be rendered', async () => {
    // A diagram the user is midway through editing should still be legible
    // rather than collapsing to an empty panel.
    const source = 'flowchart TD\n  a --> ((((\n';
    const screen = await render(<MermaidDiagram id="broken" source={source} />);

    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(screen.getByText(/flowchart TD/)).toBeVisible();
  });

  test('re-renders when the source changes', async () => {
    const screen = await render(
      <MermaidDiagram id="switch" source={'flowchart TD\n  a --> b\n'} />
    );

    const container = screen.getByTestId('mermaid-diagram');
    await expect
      .poll(function firstRendered() {
        return container.element().querySelector('svg') !== null;
      })
      .toBe(true);

    await screen.rerender(
      <MermaidDiagram id="switch" source={'flowchart TD\n  changed --> other\n'} />
    );

    await expect
      .poll(function containsNewNode() {
        return container.element().textContent?.includes('changed') ?? false;
      })
      .toBe(true);
  });
});
