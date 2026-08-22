import type { ProjectMetadata } from '@eddy/behavior-contracts';
import type { ResultAsync } from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';
import { pathEscapesProject, readFailed, type BehaviorError } from '../errors.js';
import type { FileSystemPort } from '../ports/file-system.js';

/**
 * Test doubles for the ports.
 *
 * These live in behavior-core rather than test-support because they reference
 * core's port types, and test-support must not depend on core: core already
 * depends on test-support for fast-check arbitraries, and the reverse edge would
 * make the two packages circular.
 */

export type FakeFileSystemOptions = {
  /** Paths that fail to read, mapped to the reason, for exercising error paths. */
  unreadable?: Record<string, string>;
  /** Directories that exist but cannot be listed. */
  unlistable?: readonly string[];
};

export type FakeFileSystem = FileSystemPort & {
  /** Files written through the port, for asserting on writes. */
  written: Map<string, string>;
};

/**
 * An in-memory filesystem keyed by project-relative POSIX paths.
 *
 * Applies the same path-traversal rule as the real adapter, so use cases behave
 * identically under both.
 */
export function createFakeFileSystem(
  files: Record<string, string>,
  options: FakeFileSystemOptions = {}
): FakeFileSystem {
  const contents = new Map(Object.entries(files));
  const written = new Map<string, string>();
  const unreadable = new Map(Object.entries(options.unreadable ?? {}));
  const unlistable = new Set(options.unlistable ?? []);

  /** Refuses paths that climb out of the project root. */
  function guard<T>(path: string, proceed: () => ResultAsync<T, BehaviorError>) {
    const normalized = path.replace(/\\/g, '/');
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
      return errAsync<T, BehaviorError>(pathEscapesProject(path));
    }
    return proceed();
  }

  return {
    written,

    listFiles(directory, extensions) {
      return guard(directory, function list() {
        if (unlistable.has(directory)) {
          return errAsync<string[], BehaviorError>(readFailed(directory, 'EACCES'));
        }

        const prefix = directory.replace(/\/+$/, '');
        const matches = [...contents.keys()]
          .filter(function isUnderDirectory(path) {
            return prefix.length === 0 || path.startsWith(`${prefix}/`);
          })
          .filter(function hasExtension(path) {
            return extensions.some(function matchesExtension(extension) {
              const suffix = extension.startsWith('.') ? extension : `.${extension}`;
              return path.endsWith(suffix);
            });
          })
          .sort();

        return okAsync<string[], BehaviorError>(matches);
      });
    },

    readFile(path) {
      return guard(path, function read() {
        const reason = unreadable.get(path);
        if (reason !== undefined) {
          return errAsync<string, BehaviorError>(readFailed(path, reason));
        }

        const content = contents.get(path);
        return content === undefined
          ? errAsync<string, BehaviorError>(readFailed(path, 'ENOENT'))
          : okAsync<string, BehaviorError>(content);
      });
    },

    writeFile(path, content) {
      return guard(path, function write() {
        contents.set(path, content);
        written.set(path, content);
        return okAsync<undefined, BehaviorError>(undefined);
      });
    },

    fileExists(path) {
      return guard(path, function check() {
        return okAsync<boolean, BehaviorError>(contents.has(path));
      });
    },
  };
}

/** A project configuration pointing at the conventional directories. */
export function createTestProject(overrides: Partial<ProjectMetadata> = {}): ProjectMetadata {
  return {
    id: 'test-project',
    name: 'Test Project',
    rootPath: '/repo',
    specPaths: {
      features: 'specs/features',
      diagrams: 'specs/diagrams',
    },
    testPaths: {
      e2e: 'tests/e2e',
      components: 'tests/components',
    },
    editorConfig: {
      supportedEditors: ['vscode', 'cursor'],
      openCommand: 'code',
    },
    ...overrides,
  };
}

/** A minimal but realistic set of project files, for indexing tests. */
export function createTestFiles(): Record<string, string> {
  return {
    'specs/features/login.feature': `@auth
Feature: Login
  Users sign in to reach their dashboard.

  Scenario: Successful login
    Given a registered user
    When they submit valid credentials
    Then they reach the dashboard

  Scenario: Locked account
    Given a locked user
    When they submit valid credentials
    Then they see a lockout message
`,
    'specs/features/billing.feature': `@billing
Feature: Billing
  Customers are invoiced monthly.

  Scenario: Invoice generated
    Given an active subscription
    When the billing date arrives
    Then an invoice is generated
`,
    'specs/diagrams/login.mmd': `---
title: Login flow
---
flowchart TD
  user --> credentials
  credentials --> dashboard
`,
    'tests/e2e/login.spec.ts': `import { test } from '@playwright/test';

test('Successful login', async () => {});
`,
  };
}
