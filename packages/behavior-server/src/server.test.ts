import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workbenchEventSchema } from '@eddy/behavior-contracts';
import { createFixedClock, createRecordingLogger } from '@eddy/behavior-core';
import {
  createFakeFileSystem,
  createTestFiles,
  createTestProject,
} from '@eddy/behavior-core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type BehaviorServer } from './server.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'behavior-server-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Writes the standard fixture project into a real directory. */
async function writeFixtureProject(): Promise<void> {
  const files = createTestFiles();
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, content);
  }
}

/** A server over the real filesystem at `root`. */
function realServer(overrides: Partial<Parameters<typeof createServer>[0]> = {}): BehaviorServer {
  return createServer({
    project: createTestProject({ rootPath: root }),
    projectRoot: root,
    logger: createRecordingLogger(),
    watch: false,
    ...overrides,
  });
}

describe('server over a real project directory', () => {
  it('indexes the project on start', async () => {
    await writeFixtureProject();
    const server = realServer();
    await server.start();

    const response = await server.app.inject({ method: 'GET', url: '/api/index/status' });
    expect(response.json()).toMatchObject({ state: 'ready', featureCount: 2, scenarioCount: 3 });

    await server.close();
  });

  it('serves the catalog with content read from disk', async () => {
    await writeFixtureProject();
    const server = realServer();
    await server.start();

    const response = await server.app.inject({ method: 'GET', url: '/api/catalog' });
    expect(response.json().features.map((f: { id: string }) => f.id)).toEqual(['billing', 'login']);

    await server.close();
  });

  it('starts cleanly against an empty directory', async () => {
    const server = realServer();
    await server.start();

    const response = await server.app.inject({ method: 'GET', url: '/api/index/status' });
    expect(response.json()).toMatchObject({ state: 'ready', featureCount: 0 });

    await server.close();
  });
});

describe('GET /api/events', () => {
  it('opens an event stream and pushes a subsequent event', async () => {
    const server = createServer({
      project: createTestProject(),
      projectRoot: '/repo',
      fileSystem: createFakeFileSystem(createTestFiles()),
      clock: createFixedClock(),
      logger: createRecordingLogger(),
      watch: false,
    });
    await server.start();

    const address = await server.listen(0);

    const controller = new AbortController();
    const response = await fetch(`${address}/api/events`, { signal: controller.signal });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // The handler writes a comment frame immediately so headers flush.
    const first = await reader.read();
    expect(decoder.decode(first.value)).toContain(': connected');

    server.indexer.publishScenarioStatus('login.successful-login', 'fail');

    const second = await reader.read();
    const frame = decoder.decode(second.value);
    expect(frame).toContain('event: test-status-changed');

    const data = frame.split('data: ')[1]!.split('\n')[0]!;
    expect(workbenchEventSchema.parse(JSON.parse(data))).toMatchObject({
      type: 'test-status-changed',
      scenarioId: 'login.successful-login',
      status: 'fail',
    });

    controller.abort();
    await reader.cancel().catch(function ignoreAbort() {});
    await server.close();
  });

  it('drops the subscriber when the client disconnects', async () => {
    const server = createServer({
      project: createTestProject(),
      projectRoot: '/repo',
      fileSystem: createFakeFileSystem(createTestFiles()),
      clock: createFixedClock(),
      logger: createRecordingLogger(),
      watch: false,
    });
    await server.start();
    const address = await server.listen(0);

    const controller = new AbortController();
    const response = await fetch(`${address}/api/events`, { signal: controller.signal });
    const reader = response.body!.getReader();
    await reader.read();

    expect(server.events.subscriberCount()).toBe(1);

    controller.abort();
    await reader.cancel().catch(function ignoreAbort() {});

    // Give the close handler a turn to run.
    await new Promise(function wait(resolve) {
      setTimeout(resolve, 50);
    });

    expect(server.events.subscriberCount()).toBe(0);
    await server.close();
  });
});

describe('static SPA serving', () => {
  it('serves the built shell and falls back for client routes', async () => {
    await writeFixtureProject();
    const webRoot = join(root, 'web-dist');
    await mkdir(webRoot, { recursive: true });
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>workbench</title>');
    await writeFile(join(webRoot, 'app.js'), 'export const ok = true;');

    const server = realServer({ webRoot });
    await server.start();

    const shell = await server.app.inject({ method: 'GET', url: '/index.html' });
    expect(shell.statusCode).toBe(200);
    expect(shell.body).toContain('workbench');

    const asset = await server.app.inject({ method: 'GET', url: '/app.js' });
    expect(asset.statusCode).toBe(200);

    const clientRoute = await server.app.inject({
      method: 'GET',
      url: '/features/login/scenarios/happy',
    });
    expect(clientRoute.statusCode).toBe(200);
    expect(clientRoute.body).toContain('workbench');

    await server.close();
  });

  it('keeps unknown API paths as JSON rather than serving the SPA shell', async () => {
    await writeFixtureProject();
    const webRoot = join(root, 'web-dist');
    await mkdir(webRoot, { recursive: true });
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>workbench</title>');

    const server = realServer({ webRoot });
    await server.start();

    const response = await server.app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json().tag).toBe('FileNotFound');

    await server.close();
  });

  it('runs API-only when no web root is configured', async () => {
    await writeFixtureProject();
    const server = realServer();
    await server.start();

    const response = await server.app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(404);

    await server.close();
  });
});

describe('file watching', () => {
  it('re-indexes after a spec file is added', async () => {
    await writeFixtureProject();
    const server = realServer({ watch: true, watchDebounceMs: 20 });
    await server.start();

    expect(server.indexer.status().featureCount).toBe(2);

    const seen: string[] = [];
    server.events.subscribe(event => seen.push(event.type));

    await writeFile(
      join(root, 'specs/features/added.feature'),
      'Feature: Added\n  Scenario: S\n    Given x\n'
    );

    // Wait for the watcher to fire, debounce, and finish the scan.
    const deadline = Date.now() + 5000;
    while (server.indexer.status().featureCount < 3 && Date.now() < deadline) {
      await new Promise(function wait(resolve) {
        setTimeout(resolve, 50);
      });
    }

    expect(server.indexer.status().featureCount).toBe(3);
    expect(seen).toContain('spec-changed');
    expect(seen).toContain('index-updated');

    await server.close();
  }, 15_000);

  it('batches a burst of changes into a single re-index', async () => {
    await writeFixtureProject();
    const server = realServer({ watch: true, watchDebounceMs: 120 });
    await server.start();

    const updates: string[] = [];
    server.events.subscribe(event => {
      if (event.type === 'index-updated') updates.push(event.at);
    });

    for (let index = 0; index < 5; index += 1) {
      await writeFile(
        join(root, `specs/features/burst-${index}.feature`),
        `Feature: Burst ${index}\n  Scenario: S\n    Given x\n`
      );
    }

    const deadline = Date.now() + 5000;
    while (server.indexer.status().featureCount < 7 && Date.now() < deadline) {
      await new Promise(function wait(resolve) {
        setTimeout(resolve, 50);
      });
    }

    expect(server.indexer.status().featureCount).toBe(7);
    // Requirement 7.4: simultaneous changes are batched, so five writes must not
    // produce five scans.
    expect(updates.length).toBeLessThan(5);

    await server.close();
  }, 15_000);

  it('stops watching once closed', async () => {
    await writeFixtureProject();
    const server = realServer({ watch: true, watchDebounceMs: 20 });
    await server.start();
    await server.close();

    const before = server.indexer.status().featureCount;
    await writeFile(
      join(root, 'specs/features/after-close.feature'),
      'Feature: After\n  Scenario: S\n    Given x\n'
    );
    await new Promise(function wait(resolve) {
      setTimeout(resolve, 300);
    });

    expect(server.indexer.status().featureCount).toBe(before);
  }, 15_000);
});
