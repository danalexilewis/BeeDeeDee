import { describe, expect, it } from 'vitest';
import { complexityFor, parseMermaidContent } from './mermaid.js';

const ROOT = 'specs/diagrams';

function parse(content: string, path = 'specs/diagrams/auth-flow.mmd') {
  return parseMermaidContent({ path, content, diagramsRoot: ROOT });
}

describe('complexityFor', () => {
  it.each([
    [0, 'simple'],
    [5, 'simple'],
    [6, 'moderate'],
    [15, 'moderate'],
    [16, 'complex'],
    [100, 'complex'],
  ])('buckets %i nodes as %o', (nodeCount, expected) => {
    expect(complexityFor(nodeCount)).toBe(expected);
  });
});

describe('parseMermaidContent', () => {
  it('parses a flowchart and derives an id from the path', () => {
    const result = parse('flowchart TD\n  user --> login\n  login --> dashboard\n');
    expect(result.isOk()).toBe(true);

    const diagram = result._unsafeUnwrap();
    expect(diagram.id).toBe('auth-flow');
    expect(diagram.type).toBe('mermaid');
    expect(diagram.metadata.nodeCount).toBe(3);
    expect(diagram.metadata.complexity).toBe('simple');
  });

  it('reads a title from YAML frontmatter', () => {
    const diagram = parse(
      '---\ntitle: Authentication flow\n---\nflowchart TD\n  a --> b\n'
    )._unsafeUnwrap();
    expect(diagram.title).toBe('Authentication flow');
  });

  it('strips quotes from a frontmatter title', () => {
    const diagram = parse('---\ntitle: "Quoted title"\n---\ngraph TD\n  a --> b\n')._unsafeUnwrap();
    expect(diagram.title).toBe('Quoted title');
  });

  it('reads a title from a %% comment', () => {
    const diagram = parse('%% title: Commented flow\nflowchart TD\n  a --> b\n')._unsafeUnwrap();
    expect(diagram.title).toBe('Commented flow');
  });

  it('falls back to a title derived from the filename', () => {
    const diagram = parse('flowchart TD\n  a --> b\n')._unsafeUnwrap();
    expect(diagram.title).toBe('Auth flow');
  });

  it('prefers frontmatter over a comment title', () => {
    const diagram = parse(
      '---\ntitle: From frontmatter\n---\n%% title: From comment\nflowchart TD\n  a --> b\n'
    )._unsafeUnwrap();
    expect(diagram.title).toBe('From frontmatter');
  });

  it.each([
    'sequenceDiagram\n  Alice->>Bob: hi\n',
    'classDiagram\n  Animal <|-- Duck\n',
    'stateDiagram-v2\n  [*] --> Still\n',
    'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n',
    'gantt\n  title A\n',
    'pie\n  "a" : 10\n',
    'mindmap\n  root\n',
    'journey\n  title A\n',
  ])('accepts diagram type %o', source => {
    expect(parse(source).isOk()).toBe(true);
  });

  it('records the declaration line as the start', () => {
    const diagram = parse('%% a comment\n\nflowchart TD\n  a --> b\n')._unsafeUnwrap();
    expect(diagram.lineNumbers.start).toBe(3);
  });

  it('counts lines and words over the whole file', () => {
    const diagram = parse('flowchart TD\n  a --> b\n')._unsafeUnwrap();
    expect(diagram.metadata.lineCount).toBe(3);
    expect(diagram.metadata.wordCount).toBe(5);
  });

  it('counts nodes declared with shape labels', () => {
    const diagram = parse(
      'flowchart TD\n  a[Start] --> b{Choice}\n  b --> c(End)\n'
    )._unsafeUnwrap();
    expect(diagram.metadata.nodeCount).toBe(3);
  });

  it('ignores edge labels when counting nodes', () => {
    // Regression: a backtracking edge regex used to capture fragments of
    // identifiers and label words as separate nodes.
    const piped = parse('flowchart TD\n  a -->|yes| b\n  b -->|no| c\n')._unsafeUnwrap();
    expect(piped.metadata.nodeCount).toBe(3);

    const dashed = parse('flowchart TD\n  a -- yes --> b\n')._unsafeUnwrap();
    expect(dashed.metadata.nodeCount).toBe(2);
  });

  it('bands a large diagram as complex', () => {
    const edges = Array.from({ length: 20 }, function toEdge(_unused, index) {
      return `  n${index} --> n${index + 1}`;
    }).join('\n');
    const diagram = parse(`flowchart TD\n${edges}\n`)._unsafeUnwrap();
    expect(diagram.metadata.complexity).toBe('complex');
  });

  it('preserves the source content', () => {
    const source = 'flowchart TD\n  a --> b\n';
    expect(parse(source)._unsafeUnwrap().content).toBe(source);
  });
});

describe('parseMermaidContent failures', () => {
  it('reports an empty file', () => {
    const result = parse('');
    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('MermaidSyntax');
    if (error.tag === 'MermaidSyntax') {
      expect(error.detail).toContain('empty');
    }
  });

  it('reports a file with only comments', () => {
    expect(parse('%% just a comment\n').isErr()).toBe(true);
  });

  it('reports an unrecognised diagram declaration with a line number', () => {
    const result = parse('%% header\nnotADiagram TD\n  a --> b\n');
    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    if (error.tag === 'MermaidSyntax') {
      expect(error.line).toBe(2);
      expect(error.detail).toContain('no recognised Mermaid diagram declaration');
    }
  });

  it('does not accept a keyword appearing mid-line', () => {
    expect(parse('  a --> flowchart\n').isErr()).toBe(true);
  });
});
