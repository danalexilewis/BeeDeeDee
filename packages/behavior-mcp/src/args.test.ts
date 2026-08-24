import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultProject, parseArgs } from './args.js';

describe('parseArgs', () => {
  it('defaults to the working directory with writes disabled', () => {
    const parsed = parseArgs([]);
    expect(parsed.projectRoot).toBe(resolve(process.cwd()));
    expect(parsed.allowWrites).toBe(false);
  });

  it('never enables writes implicitly', () => {
    // Writes are the one capability a human must opt into, so no combination of
    // other flags may turn them on.
    expect(parseArgs(['--project', '/tmp/x']).allowWrites).toBe(false);
    expect(parseArgs(['-C', '/tmp/x']).allowWrites).toBe(false);
  });

  it('enables writes only for the explicit flag', () => {
    expect(parseArgs(['--allow-writes']).allowWrites).toBe(true);
  });

  it.each([[['--project', '/tmp/demo']], [['-C', '/tmp/demo']], [['--project=/tmp/demo']]])(
    'reads the project root from %o',
    argv => {
      expect(parseArgs(argv).projectRoot).toBe('/tmp/demo');
    }
  );

  it('resolves a relative project root', () => {
    expect(parseArgs(['--project', '.']).projectRoot).toBe(resolve('.'));
  });

  it('ignores a trailing --project with no value', () => {
    expect(parseArgs(['--project']).projectRoot).toBe(resolve(process.cwd()));
  });

  it('ignores unknown flags rather than failing', () => {
    // A host may pass extra arguments; refusing to start would be worse than
    // ignoring what we do not recognise.
    const parsed = parseArgs(['--unknown', '--allow-writes', '--project', '/tmp/demo']);
    expect(parsed).toEqual({ projectRoot: '/tmp/demo', allowWrites: true });
  });
});

describe('defaultProject', () => {
  it('matches the conventional layout including mappings', () => {
    const project = defaultProject('/repo/demo');
    expect(project.specPaths).toEqual({
      features: 'specs/features',
      diagrams: 'specs/diagrams',
      mappings: 'specs/mappings',
    });
    expect(project.id).toBe('demo');
  });
});
