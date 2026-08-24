import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

let initialised = false;

/** Configures Mermaid once per page. */
function ensureInitialised(): void {
  if (initialised) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    themeVariables: {
      primaryColor: '#fffbe6',
      primaryTextColor: '#171717',
      primaryBorderColor: '#171717',
      lineColor: '#171717',
      secondaryColor: '#f3ecd0',
      tertiaryColor: '#fffbe6',
      background: '#fffbe6',
      mainBkg: '#fffbe6',
      nodeBorder: '#171717',
      clusterBkg: '#f3ecd0',
      titleColor: '#171717',
      edgeLabelBackground: '#fffbe6',
    },
    securityLevel: 'strict',
    flowchart: { htmlLabels: false },
  });
  initialised = true;
}

export type MermaidDiagramProps = {
  /** Mermaid source, including any frontmatter. */
  source: string;
  /** Unique id for the rendered SVG, required by Mermaid. */
  id: string;
  className?: string;
};

/**
 * Renders Mermaid source to inline SVG.
 *
 * Rendering is asynchronous and can fail on invalid source, so failure is shown
 * as the original text rather than an empty panel — a diagram the user is midway
 * through editing should still be readable.
 */
export function MermaidDiagram({ source, id, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(
    function renderDiagram() {
      let cancelled = false;
      ensureInitialised();

      async function render(): Promise<void> {
        try {
          const { svg } = await mermaid.render(`mermaid-${id}`, source);
          if (cancelled) return;
          setError(undefined);
          if (containerRef.current !== null) containerRef.current.innerHTML = svg;
        } catch (thrown) {
          if (cancelled) return;
          setError(thrown instanceof Error ? thrown.message : 'Could not render this diagram');
        }
      }

      void render();

      return function cancel() {
        cancelled = true;
      };
    },
    [source, id]
  );

  if (error !== undefined) {
    return (
      <div className={cn('space-y-2', className)}>
        <p role="alert" className="text-failing text-xs">
          {error}
        </p>
        <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">{source}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="mermaid-diagram"
      className={cn('[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full', className)}
    />
  );
}
