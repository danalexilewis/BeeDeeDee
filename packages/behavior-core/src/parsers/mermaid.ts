import type { Complexity, ParsedDiagram } from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { diagramIdFromPath } from '../domain/ids.js';
import { mermaidSyntax, type BehaviorError } from '../errors.js';

/**
 * Mermaid diagram keywords that open a diagram body.
 *
 * Parsing is plain text analysis rather than the `mermaid` package, which needs a
 * DOM to render and would drag a browser dependency into the domain. Rendering
 * stays in the SPA; the indexer only needs metadata.
 */
const DIAGRAM_KEYWORDS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram-v2',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
  'block-beta',
  'sankey-beta',
  'xychart-beta',
] as const;

const MODERATE_NODE_LIMIT = 5;
const COMPLEX_NODE_LIMIT = 15;

export type ParseMermaidInput = {
  path: string;
  content: string;
  /** Root the diagram id is made relative to. */
  diagramsRoot: string;
};

/** Splits content into lines with their one-based numbers, dropping comments. */
function meaningfulLines(content: string): Array<{ line: number; text: string }> {
  return content
    .split(/\r?\n/)
    .map(function toEntry(text, index) {
      return { line: index + 1, text: text.trim() };
    })
    .filter(function isMeaningful(entry) {
      return entry.text.length > 0 && !entry.text.startsWith('%%');
    });
}

/** Extracts a `title:` value from YAML frontmatter, when present. */
function frontmatterTitle(content: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content.trimStart());
  if (match === null) return undefined;

  const titleMatch = /^\s*title:\s*(.+)$/m.exec(match[1] ?? '');
  return titleMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '');
}

/** Extracts a title from a `%% title: ...` comment, when present. */
function commentTitle(content: string): string | undefined {
  const match = /^\s*%%\s*title:\s*(.+)$/m.exec(content);
  return match?.[1]?.trim();
}

/** Finds the line that declares the diagram type. */
function findDeclaration(
  lines: ReadonlyArray<{ line: number; text: string }>
): { line: number; keyword: string } | undefined {
  for (const entry of lines) {
    for (const keyword of DIAGRAM_KEYWORDS) {
      if (entry.text === keyword || entry.text.startsWith(`${keyword} `)) {
        return { line: entry.line, keyword };
      }
    }
  }
  return undefined;
}

/** Edge operators across the flowchart-like diagram types. */
const EDGE_OPERATOR = /-{2,}>|={2,}>|-\.+->|<-{2,}>|-{2,}|={2,}|~~~/g;

/** Leading identifier of a fragment, e.g. `b` in ` b{Choice}`. */
const LEADING_IDENTIFIER = /^\s*([A-Za-z0-9_]+)/;

/** Standalone node declaration carrying a shape label, e.g. `a[Start]`. */
const SHAPE_DECLARATION = /^([A-Za-z0-9_]+)\s*[[({]/;

/**
 * Counts distinct node identifiers.
 *
 * Takes the identifier at the start of a line as the edge source and the one
 * after the final edge operator as its target, which skips inline edge labels in
 * both the `|label|` and `-- label -->` forms. Node syntax varies by diagram
 * type, so this is an approximation feeding the complexity band only, never
 * correctness.
 */
function countNodes(lines: ReadonlyArray<{ line: number; text: string }>): number {
  const nodes = new Set<string>();

  for (const entry of lines) {
    const withoutLabels = entry.text.replace(/\|[^|]*\|/g, ' ');
    const operators = [...withoutLabels.matchAll(EDGE_OPERATOR)];

    if (operators.length === 0) {
      const declaration = SHAPE_DECLARATION.exec(entry.text);
      if (declaration?.[1] !== undefined) nodes.add(declaration[1]);
      continue;
    }

    const source = LEADING_IDENTIFIER.exec(withoutLabels);
    if (source?.[1] !== undefined) nodes.add(source[1]);

    const lastOperator = operators.at(-1);
    if (lastOperator?.index !== undefined) {
      const remainder = withoutLabels.slice(lastOperator.index + lastOperator[0].length);
      const target = LEADING_IDENTIFIER.exec(remainder);
      if (target?.[1] !== undefined) nodes.add(target[1]);
    }
  }

  return nodes.size;
}

/** Buckets a node count into a complexity band. */
export function complexityFor(nodeCount: number): Complexity {
  if (nodeCount <= MODERATE_NODE_LIMIT) return 'simple';
  if (nodeCount <= COMPLEX_NODE_LIMIT) return 'moderate';
  return 'complex';
}

/** Derives a display title from the file path when the source declares none. */
function titleFromPath(path: string): string {
  const base = path
    .replace(/\\/g, '/')
    .split('/')
    .at(-1)
    ?.replace(/\.(mmd|mermaid|puml|drawio)$/i, '');

  if (base === undefined || base.length === 0) return 'Untitled diagram';

  return base.replace(/[-_]+/g, ' ').replace(/^./, function toUpper(character) {
    return character.toUpperCase();
  });
}

/**
 * Parses a Mermaid file into diagram metadata.
 *
 * Fails only when no recognised diagram declaration is present, which is the one
 * error the indexer can report usefully without a full Mermaid grammar.
 */
export function parseMermaidContent(
  input: ParseMermaidInput
): Result<ParsedDiagram, BehaviorError> {
  const lines = meaningfulLines(input.content);

  if (lines.length === 0) {
    return err(mermaidSyntax(input.path, 1, 'file is empty'));
  }

  const declaration = findDeclaration(lines);
  if (declaration === undefined) {
    return err(
      mermaidSyntax(
        input.path,
        lines[0]?.line ?? 1,
        'no recognised Mermaid diagram declaration, expected one of ' +
          DIAGRAM_KEYWORDS.slice(0, 6).join(', ')
      )
    );
  }

  const bodyLines = lines.filter(function isAfterDeclaration(entry) {
    return entry.line > declaration.line;
  });

  const nodeCount = countNodes(bodyLines);
  const allLines = input.content.split(/\r?\n/);

  return ok({
    id: diagramIdFromPath(input.diagramsRoot, input.path),
    type: 'mermaid',
    path: input.path,
    title:
      frontmatterTitle(input.content) ?? commentTitle(input.content) ?? titleFromPath(input.path),
    content: input.content,
    metadata: {
      lineCount: allLines.length,
      wordCount: input.content.split(/\s+/).filter(function isWord(word) {
        return word.length > 0;
      }).length,
      nodeCount,
      complexity: complexityFor(nodeCount),
    },
    lineNumbers: {
      start: declaration.line,
      end: Math.max(declaration.line, lines.at(-1)?.line ?? declaration.line),
    },
  });
}
