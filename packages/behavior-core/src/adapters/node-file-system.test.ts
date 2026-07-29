import { mkdtemp, rm, writeFile, mkdir, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNodeFileSystem, isMissingPathError } from './node-file-system.js';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'behavior-fs-'));
  await mkdir(join(root, 'specs/features'), { recursive: true });
  await mkdir(join(root, 'specs/diagrams'), { recursive: true });
  await mkdir(join(root, 'nested/deep'), { recursive: true });

  await writeFile(join(root, 'specs/features/login.feature'), 'Feature: Login\n');
  await writeFile(join(root, 'specs/features/billing.feature'), 'Feature: Billing\n');
  await writeFile(join(root, 'specs/diagrams/flow.mmd'), 'flowchart TD\n');
  await writeFile(join(root, 'nested/deep/nested.feature'), 'Feature: Nested\n');
  await writeFile(join(root, 'specs/features/notes.txt'), 'ignore me\n');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('isMissingPathError', () => {
  it.each([
    [{ code: 'ENOENT' }, true],
    [{ code: 'ENOTDIR' }, true],
    [{ code: 'EACCES' }, false],
    [new Error('plain'), false],
    [null, false],
    ['string', false],
  ])('classifies %o as %o', (thrown, expected) => {
    expect(isMissingPathError(thrown)).toBe(expected);
  });
});

describe('createNodeFileSystem path confinement', () => {
  it.each(['../outside.feature', '../../etc/passwd', 'specs/../../escape.feature', '/etc/passwd'])(
    'refuses to read %o',
    async path => {
      const fileSystem = createNodeFileSystem(root);
      const result = await fileSystem.readFile(path);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().tag).toBe('PathEscapesProject');
    }
  );

  it('refuses to write outside the root', async () => {
    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.writeFile('../escape.txt', 'nope');
    expect(result._unsafeUnwrapErr().tag).toBe('PathEscapesProject');
  });

  it('refuses to list outside the root', async () => {
    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.listFiles('../', ['.feature']);
    expect(result._unsafeUnwrapErr().tag).toBe('PathEscapesProject');
  });

  it('allows a path that traverses upward but lands back inside', async () => {
    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.readFile('specs/diagrams/../features/login.feature');
    expect(result.isOk()).toBe(true);
  });

  it('allows an absolute path inside the root', async () => {
    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.readFile(join(root, 'specs/features/login.feature'));
    expect(result._unsafeUnwrap()).toBe('Feature: Login\n');
  });
});

describe('createNodeFileSystem listFiles', () => {
  it('lists matching files as project-relative paths, sorted', async () => {
    const fileSystem = createNodeFileSystem(root);
    const files = (await fileSystem.listFiles('specs/features', ['.feature']))._unsafeUnwrap();
    expect(files).toEqual(['specs/features/billing.feature', 'specs/features/login.feature']);
  });

  it('ignores files with other extensions', async () => {
    const fileSystem = createNodeFileSystem(root);
    const files = (await fileSystem.listFiles('specs/features', ['.feature']))._unsafeUnwrap();
    expect(files.some(file => file.endsWith('.txt'))).toBe(false);
  });

  it('recurses into subdirectories', async () => {
    const fileSystem = createNodeFileSystem(root);
    const files = (await fileSystem.listFiles('nested', ['.feature']))._unsafeUnwrap();
    expect(files).toEqual(['nested/deep/nested.feature']);
  });

  it('accepts extensions with or without a leading dot', async () => {
    const fileSystem = createNodeFileSystem(root);
    const withDot = (await fileSystem.listFiles('specs/features', ['.feature']))._unsafeUnwrap();
    const withoutDot = (await fileSystem.listFiles('specs/features', ['feature']))._unsafeUnwrap();
    expect(withoutDot).toEqual(withDot);
  });

  it('returns an empty list for a directory that does not exist', async () => {
    const fileSystem = createNodeFileSystem(root);
    const files = (await fileSystem.listFiles('does/not/exist', ['.feature']))._unsafeUnwrap();
    expect(files).toEqual([]);
  });

  it('matches several extensions at once', async () => {
    const fileSystem = createNodeFileSystem(root);
    const files = (await fileSystem.listFiles('specs', ['.feature', '.mmd']))._unsafeUnwrap();
    expect(files).toHaveLength(3);
  });
});

describe('createNodeFileSystem readFile, writeFile, fileExists', () => {
  it('reads a file as UTF-8', async () => {
    const fileSystem = createNodeFileSystem(root);
    expect((await fileSystem.readFile('specs/features/login.feature'))._unsafeUnwrap()).toBe(
      'Feature: Login\n'
    );
  });

  it('reports a missing file as ReadFailed', async () => {
    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.readFile('specs/features/missing.feature');
    expect(result._unsafeUnwrapErr().tag).toBe('ReadFailed');
  });

  it('writes a file, creating parent directories', async () => {
    const fileSystem = createNodeFileSystem(root);
    const written = await fileSystem.writeFile('generated/deep/new.feature', 'Feature: New\n');
    expect(written.isOk()).toBe(true);
    expect((await fileSystem.readFile('generated/deep/new.feature'))._unsafeUnwrap()).toBe(
      'Feature: New\n'
    );
  });

  it('reports an existing file', async () => {
    const fileSystem = createNodeFileSystem(root);
    expect((await fileSystem.fileExists('specs/features/login.feature'))._unsafeUnwrap()).toBe(
      true
    );
  });

  it('reports a missing file as absent rather than failing', async () => {
    const fileSystem = createNodeFileSystem(root);
    expect((await fileSystem.fileExists('nope.feature'))._unsafeUnwrap()).toBe(false);
  });

  it('reports a directory as not a file', async () => {
    const fileSystem = createNodeFileSystem(root);
    expect((await fileSystem.fileExists('specs/features'))._unsafeUnwrap()).toBe(false);
  });

  it('refuses to check a path outside the root', async () => {
    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.fileExists('../outside');
    expect(result._unsafeUnwrapErr().tag).toBe('PathEscapesProject');
  });
});

describe('createNodeFileSystem unreadable directories', () => {
  it('reports a listing failure rather than reporting an empty directory', async () => {
    // A directory that exists but cannot be read must not look like an empty one,
    // or a permissions problem would silently empty the catalog.
    const locked = join(root, 'locked');
    await mkdir(locked, { recursive: true });
    await writeFile(join(locked, 'a.feature'), 'Feature: A\n');
    await chmod(locked, 0o000);

    const fileSystem = createNodeFileSystem(root);
    const result = await fileSystem.listFiles('locked', ['.feature']);

    await chmod(locked, 0o755);

    // Running as root bypasses permission bits, so only assert when the chmod bit.
    if (result.isErr()) {
      expect(result._unsafeUnwrapErr().tag).toBe('ReadFailed');
    } else {
      expect(result._unsafeUnwrap()).toEqual(['locked/a.feature']);
    }
  });
});
