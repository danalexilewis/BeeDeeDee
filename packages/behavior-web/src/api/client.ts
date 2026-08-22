import { behaviorContract } from '@eddy/behavior-contracts';
import { initClient } from '@ts-rest/core';

/**
 * The typed contract client.
 *
 * Built from `@ts-rest/core` rather than `@ts-rest/react-query`, because that
 * adapter peers on React 18 or below in every published release. Wrapping
 * `initClient` in TanStack Query option factories costs a few lines per endpoint
 * and keeps full inference from the contract.
 *
 * A relative base URL means the same build works behind the Vite dev proxy and
 * when Fastify serves the bundle itself.
 */
export const api = initClient(behaviorContract, {
  baseUrl: '',
  baseHeaders: { 'content-type': 'application/json' },
  throwOnUnknownStatus: false,
});

export type ApiClient = typeof api;

/** An error carrying the status the API reported, for status-aware UI. */
export type ApiError = Error & {
  status: number;
  tag?: string;
};

/** Builds an Error from a non-2xx contract response. */
export function toApiError(status: number, body: unknown): ApiError {
  const isErrorBody =
    typeof body === 'object' && body !== null && 'tag' in body && 'message' in body;

  const message = isErrorBody
    ? String((body as { message: unknown }).message)
    : `Request failed with status ${status}`;

  const error = new Error(message) as ApiError;
  error.status = status;
  if (isErrorBody) error.tag = String((body as { tag: unknown }).tag);
  return error;
}

/**
 * Unwraps a contract response, throwing on failure.
 *
 * TanStack Query signals failure by rejection, so this is the one place the
 * Result-style discipline of the server gives way to throwing. Keeping the
 * conversion here means components only ever see data or an ApiError.
 */
export function unwrap<TBody>(response: { status: number; body: unknown }): TBody {
  if (response.status >= 200 && response.status < 300) return response.body as TBody;
  throw toApiError(response.status, response.body);
}
