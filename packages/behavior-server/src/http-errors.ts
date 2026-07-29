import type { ErrorBody } from '@eddy/behavior-contracts';
import { toErrorBody, type BehaviorError } from '@eddy/behavior-core';

/** Status codes the contract declares. */
export type ErrorStatus = 404 | 422 | 500 | 503;

/**
 * The single place domain errors meet HTTP semantics.
 *
 * Keeping the mapping in one exhaustive switch means adding a failure mode to
 * BehaviorError forces a decision about its status code here, rather than
 * defaulting silently to 500 somewhere in a route handler.
 */
export function statusFor(error: BehaviorError): ErrorStatus {
  switch (error.tag) {
    // The requested thing genuinely is not there.
    case 'ScenarioNotFound':
    case 'FeatureNotFound':
    case 'DiagramNotFound':
    case 'FileNotFound':
      return 404;

    // The caller sent something the server cannot accept.
    case 'SchemaValidation':
    case 'UnsupportedReportFormat':
    case 'EditorNotSupported':
    case 'PathEscapesProject':
      return 422;

    // The server is not ready to answer yet, but will be.
    case 'IndexNotReady':
      return 503;

    // A real server-side failure.
    case 'ReadFailed':
    case 'GherkinSyntax':
    case 'MermaidSyntax':
      return 500;
  }
}

/** An error rendered as a status code and body. */
export function toHttpResponse(error: BehaviorError): { status: ErrorStatus; body: ErrorBody } {
  return { status: statusFor(error), body: toErrorBody(error) };
}

/**
 * Renders an error using only statuses the route actually declares.
 *
 * With `strictStatusCodes` on, returning an undeclared status fails ts-rest's
 * response validation at runtime. Rather than trust every handler to enumerate
 * its own error cases correctly, each one passes the statuses its contract entry
 * permits and anything else degrades to 500, which `commonResponses` puts on
 * every route.
 */
export function toDeclaredHttpResponse<TAllowed extends ErrorStatus>(
  error: BehaviorError,
  allowed: readonly TAllowed[]
): { status: TAllowed | 500; body: ErrorBody } {
  const status = statusFor(error);
  const permitted = (allowed as readonly ErrorStatus[]).includes(status);

  return {
    status: permitted ? (status as TAllowed) : 500,
    body: toErrorBody(error),
  };
}
