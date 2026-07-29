import { createFakeFileSystem, createTestFiles } from '@eddy/behavior-core/testing';
import { describe, expect, it } from 'vitest';
import { applyConfig, configTemplate, defaultConfig, loadConfig, parseConfig } from './config.js';

describe('defaultConfig', () => {
  it('describes the conventional project layout', () => {
    const config = defaultConfig('/repo/my-project');
    expect(config.project.specPaths.features).toBe('specs/features');
    expect(config.project.testPaths.e2e).toBe('tests/e2e');
    expect(config.server).toEqual({ port: 4000, host: '127.0.0.1' });
  });

  it('names the project after its directory', () => {
    expect(defaultConfig('/repo/my-project').project.name).toBe('my-project');
    expect(defaultConfig('/repo/my-project').project.id).toBe('my-project');
  });

  it('records an absolute root path', () => {
    expect(defaultConfig('.').project.rootPath.startsWith('/')).toBe(true);
  });
});

describe('parseConfig', () => {
  it('accepts an empty object, since every field is an override', () => {
    expect(parseConfig('{}', '.behaviorrc')._unsafeUnwrap()).toEqual({});
  });

  it('accepts a partial configuration', () => {
    const config = parseConfig('{"specPaths":{"features":"docs/specs"}}', '.behaviorrc');
    expect(config._unsafeUnwrap().specPaths?.features).toBe('docs/specs');
  });

  it('reports invalid JSON as a schema violation naming the file', () => {
    const result = parseConfig('{ not json', '.behaviorrc');
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('SchemaValidation');
    if (error.tag === 'SchemaValidation') expect(error.subject).toBe('.behaviorrc');
  });

  it('reports an unknown editor', () => {
    const result = parseConfig('{"editorConfig":{"supportedEditors":["emacs"]}}', '.behaviorrc');
    expect(result.isErr()).toBe(true);
  });

  it('reports an out-of-range port', () => {
    expect(parseConfig('{"server":{"port":70000}}', '.behaviorrc').isErr()).toBe(true);
  });

  it('reports an empty path string rather than accepting it', () => {
    expect(parseConfig('{"specPaths":{"features":""}}', '.behaviorrc').isErr()).toBe(true);
  });

  it('names the offending field in the issue path', () => {
    const error = parseConfig('{"server":{"port":-1}}', '.behaviorrc')._unsafeUnwrapErr();
    if (error.tag === 'SchemaValidation') {
      expect(error.issues[0]!.path).toBe('server.port');
    }
  });
});

describe('applyConfig', () => {
  it('overrides only the fields the file sets', () => {
    const base = defaultConfig('/repo/demo');
    const merged = applyConfig(base, { specPaths: { features: 'docs/specs' } }, '.behaviorrc');

    expect(merged.project.specPaths.features).toBe('docs/specs');
    expect(merged.project.specPaths.diagrams).toBe('specs/diagrams');
    expect(merged.project.testPaths.e2e).toBe('tests/e2e');
  });

  it('records where the settings came from', () => {
    const merged = applyConfig(defaultConfig('/repo/demo'), {}, '.behaviorrc');
    expect(merged.sourcePath).toBe('.behaviorrc');
  });

  it('overrides the project name', () => {
    const merged = applyConfig(defaultConfig('/repo/demo'), { name: 'Renamed' }, '.behaviorrc');
    expect(merged.project.name).toBe('Renamed');
    // The id stays derived from the directory, so renaming does not break links.
    expect(merged.project.id).toBe('demo');
  });

  it('overrides the server port', () => {
    const merged = applyConfig(
      defaultConfig('/repo/demo'),
      { server: { port: 8080 } },
      '.behaviorrc'
    );
    expect(merged.server).toEqual({ port: 8080, host: '127.0.0.1' });
  });
});

describe('loadConfig', () => {
  it('falls back to defaults when no file exists', async () => {
    const fileSystem = createFakeFileSystem(createTestFiles());
    const config = (await loadConfig(fileSystem, '/repo'))._unsafeUnwrap();

    expect(config.sourcePath).toBeUndefined();
    expect(config.project.specPaths.features).toBe('specs/features');
  });

  it('reads .behaviorrc when present', async () => {
    const fileSystem = createFakeFileSystem({
      '.behaviorrc': '{"name":"Configured","specPaths":{"features":"docs/features"}}',
    });
    const config = (await loadConfig(fileSystem, '/repo'))._unsafeUnwrap();

    expect(config.sourcePath).toBe('.behaviorrc');
    expect(config.project.name).toBe('Configured');
    expect(config.project.specPaths.features).toBe('docs/features');
  });

  it('falls back to .behaviorrc.json', async () => {
    const fileSystem = createFakeFileSystem({ '.behaviorrc.json': '{"name":"From json"}' });
    const config = (await loadConfig(fileSystem, '/repo'))._unsafeUnwrap();

    expect(config.sourcePath).toBe('.behaviorrc.json');
    expect(config.project.name).toBe('From json');
  });

  it('prefers .behaviorrc over .behaviorrc.json', async () => {
    const fileSystem = createFakeFileSystem({
      '.behaviorrc': '{"name":"Preferred"}',
      '.behaviorrc.json': '{"name":"Ignored"}',
    });
    expect((await loadConfig(fileSystem, '/repo'))._unsafeUnwrap().project.name).toBe('Preferred');
  });

  it('fails on a malformed file rather than silently using defaults', async () => {
    // Ignoring a broken config would leave the user staring at the wrong
    // directories with no explanation.
    const fileSystem = createFakeFileSystem({ '.behaviorrc': 'not json at all' });
    const result = await loadConfig(fileSystem, '/repo');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().tag).toBe('SchemaValidation');
  });
});

describe('configTemplate', () => {
  it('produces a file that parses back to a valid config', () => {
    const template = configTemplate('demo');
    expect(parseConfig(template, '.behaviorrc').isOk()).toBe(true);
  });

  it('names the project', () => {
    expect(JSON.parse(configTemplate('demo')).name).toBe('demo');
  });

  it('ends with a newline', () => {
    expect(configTemplate('demo').endsWith('\n')).toBe(true);
  });
});
