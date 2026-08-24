import { behaviorErrorTagSchema, errorSchema } from '@eddy/behavior-contracts';
import {
  architectureMapNotFound,
  diagramNotFound,
  editorNotSupported,
  featureNotFound,
  fileNotFound,
  gherkinSyntax,
  indexNotReady,
  mermaidSyntax,
  pathEscapesProject,
  readFailed,
  scenarioNotFound,
  schemaValidation,
  unsupportedReportFormat,
  type BehaviorError,
} from '@eddy/behavior-core';
import { describe, expect, it } from 'vitest';
import { statusFor, toDeclaredHttpResponse, toHttpResponse } from './http-errors.js';

const EVERY_ERROR: BehaviorError[] = [
  fileNotFound('a.feature'),
  readFailed('a.feature', 'EACCES'),
  gherkinSyntax('a.feature', 4, 3, 'bad'),
  mermaidSyntax('a.mmd', 2, 'bad'),
  schemaValidation('report', [{ path: 'suites', message: 'expected array' }]),
  scenarioNotFound('s'),
  featureNotFound('f'),
  diagramNotFound('d'),
  architectureMapNotFound('m'),
  editorNotSupported('emacs'),
  pathEscapesProject('../etc/passwd'),
  unsupportedReportFormat('junit-xml'),
  indexNotReady(),
];

describe('statusFor', () => {
  it('maps every error tag to a status', () => {
    const covered = new Set(EVERY_ERROR.map(error => error.tag));
    expect([...covered].sort()).toEqual([...behaviorErrorTagSchema.options].sort());

    for (const error of EVERY_ERROR) {
      expect([404, 422, 500, 503], error.tag).toContain(statusFor(error));
    }
  });

  it.each([
    ['ScenarioNotFound', 404],
    ['FeatureNotFound', 404],
    ['DiagramNotFound', 404],
    ['ArchitectureMapNotFound', 404],
    ['FileNotFound', 404],
  ] as const)('maps %s to %i', (tag, expected) => {
    const error = EVERY_ERROR.find(candidate => candidate.tag === tag)!;
    expect(statusFor(error)).toBe(expected);
  });

  it('maps caller mistakes to 422', () => {
    expect(statusFor(schemaValidation('r', []))).toBe(422);
    expect(statusFor(unsupportedReportFormat('x'))).toBe(422);
    expect(statusFor(editorNotSupported('emacs'))).toBe(422);
  });

  it('maps a path escaping the project to 422 rather than 403', () => {
    // The caller asked for something outside the project, which is a bad request
    // rather than a permissions decision the server is making.
    expect(statusFor(pathEscapesProject('../x'))).toBe(422);
  });

  it('maps a not-yet-ready index to 503', () => {
    expect(statusFor(indexNotReady())).toBe(503);
  });

  it('maps genuine server faults to 500', () => {
    expect(statusFor(readFailed('a', 'EIO'))).toBe(500);
    expect(statusFor(gherkinSyntax('a', 1, 1, 'x'))).toBe(500);
    expect(statusFor(mermaidSyntax('a', 1, 'x'))).toBe(500);
  });
});

describe('toHttpResponse', () => {
  it('produces a contract-valid body for every error', () => {
    for (const error of EVERY_ERROR) {
      const response = toHttpResponse(error);
      expect(errorSchema.safeParse(response.body).success, error.tag).toBe(true);
    }
  });
});

describe('toDeclaredHttpResponse', () => {
  it('uses the mapped status when the route declares it', () => {
    const response = toDeclaredHttpResponse(scenarioNotFound('s'), [404, 503, 500]);
    expect(response.status).toBe(404);
  });

  it('degrades to 500 when the route does not declare the mapped status', () => {
    // A route with no 404 must not emit one: strictStatusCodes would fail
    // response validation at runtime.
    const response = toDeclaredHttpResponse(scenarioNotFound('s'), [503, 500]);
    expect(response.status).toBe(500);
  });

  it('keeps the original error body when degrading the status', () => {
    const response = toDeclaredHttpResponse(scenarioNotFound('s'), [503, 500]);
    expect(response.body.tag).toBe('ScenarioNotFound');
  });

  it('passes 503 through for a read route', () => {
    expect(toDeclaredHttpResponse(indexNotReady(), [503, 500]).status).toBe(503);
  });

  it('passes 422 through for an ingest route', () => {
    expect(toDeclaredHttpResponse(schemaValidation('r', []), [422, 503, 500]).status).toBe(422);
  });
});
