import { behaviorErrorTagSchema, errorSchema } from '@eddy/behavior-contracts';
import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';
import {
  assertTagsMatchContract,
  describeError,
  diagramNotFound,
  editorNotSupported,
  featureNotFound,
  fileNotFound,
  gherkinSyntax,
  indexNotReady,
  mermaidSyntax,
  partitionResults,
  pathEscapesProject,
  readFailed,
  scenarioNotFound,
  schemaValidation,
  toErrorBody,
  tryRead,
  unsupportedReportFormat,
  type BehaviorError,
} from './errors.js';

/** One instance of every error tag, so tests can assert exhaustively. */
const EVERY_ERROR: BehaviorError[] = [
  fileNotFound('a.feature'),
  readFailed('a.feature', 'EACCES'),
  gherkinSyntax('a.feature', 4, 3, 'unexpected token'),
  mermaidSyntax('a.mmd', 2, 'no declaration'),
  schemaValidation('Playwright report', [{ path: 'suites', message: 'expected array' }]),
  scenarioNotFound('login/happy'),
  featureNotFound('login'),
  diagramNotFound('auth-flow'),
  editorNotSupported('emacs'),
  pathEscapesProject('../../etc/passwd'),
  unsupportedReportFormat('junit-xml'),
  indexNotReady(),
];

describe('error tags', () => {
  it('matches the contract enum at compile time', () => {
    expect(assertTagsMatchContract).toBe(true);
  });

  it('covers every contract tag with a constructor', () => {
    const produced = new Set(EVERY_ERROR.map(error => error.tag));
    expect([...produced].sort()).toEqual([...behaviorErrorTagSchema.options].sort());
  });
});

describe('describeError', () => {
  it('produces a non-empty message for every tag', () => {
    for (const error of EVERY_ERROR) {
      expect(describeError(error).length, error.tag).toBeGreaterThan(0);
    }
  });

  it('includes the location in a Gherkin syntax message', () => {
    expect(describeError(gherkinSyntax('a.feature', 4, 3, 'bad'))).toBe(
      'Gherkin syntax error in a.feature at 4:3: bad'
    );
  });

  it('summarises every schema issue', () => {
    const message = describeError(
      schemaValidation('report', [
        { path: 'a', message: 'required' },
        { path: 'b', message: 'expected number' },
      ])
    );
    expect(message).toContain('a: required');
    expect(message).toContain('b: expected number');
  });

  it('omits an empty path from a schema issue', () => {
    expect(describeError(schemaValidation('report', [{ path: '', message: 'root problem' }]))).toBe(
      'Invalid report: root problem'
    );
  });
});

describe('toErrorBody', () => {
  it('produces a body matching the contract schema for every tag', () => {
    for (const error of EVERY_ERROR) {
      const parsed = errorSchema.safeParse(toErrorBody(error));
      expect(parsed.success, `${error.tag} produced an invalid body`).toBe(true);
    }
  });

  it('carries tag-specific details', () => {
    const body = toErrorBody(gherkinSyntax('a.feature', 4, 3, 'bad'));
    expect(body.details).toEqual({ path: 'a.feature', line: 4, column: 3 });
  });

  it('omits details for an error that carries none', () => {
    expect(toErrorBody(indexNotReady()).details).toBeUndefined();
  });

  it('survives a JSON round trip', () => {
    for (const error of EVERY_ERROR) {
      const body = toErrorBody(error);
      expect(errorSchema.parse(JSON.parse(JSON.stringify(body)))).toEqual(body);
    }
  });
});

describe('partitionResults', () => {
  it('separates successes from failures', () => {
    const { values, errors } = partitionResults([
      ok(1),
      err(fileNotFound('a')),
      ok(2),
      err(indexNotReady()),
    ]);
    expect(values).toEqual([1, 2]);
    expect(errors.map(e => e.tag)).toEqual(['FileNotFound', 'IndexNotReady']);
  });

  it('preserves the order of successes', () => {
    const { values } = partitionResults([ok('a'), err(indexNotReady()), ok('b'), ok('c')]);
    expect(values).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty list', () => {
    expect(partitionResults([])).toEqual({ values: [], errors: [] });
  });
});

describe('tryRead', () => {
  it('wraps a successful call', () => {
    expect(tryRead('a', () => 42)._unsafeUnwrap()).toBe(42);
  });

  it('converts a thrown Error into a ReadFailed carrying its message', () => {
    const result = tryRead('a.feature', () => {
      throw new Error('EACCES');
    });
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('ReadFailed');
    if (error.tag === 'ReadFailed') {
      expect(error.path).toBe('a.feature');
      expect(error.reason).toBe('EACCES');
    }
  });

  it('stringifies a non-Error throw', () => {
    const result = tryRead('a', () => {
      throw 'plain string';
    });
    const error = result._unsafeUnwrapErr();
    if (error.tag === 'ReadFailed') {
      expect(error.reason).toBe('plain string');
    }
  });
});
