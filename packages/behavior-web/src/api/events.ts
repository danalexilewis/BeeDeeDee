import { workbenchEventSchema, type WorkbenchEvent } from '@eddy/behavior-contracts';

/** Stops an event subscription. */
export type Unsubscribe = () => void;

/**
 * Subscribes to workbench events over SSE.
 *
 * Payloads are validated with the same schema the server publishes, so a
 * mismatched deploy is reported rather than silently producing a malformed
 * update. The browser reconnects an EventSource automatically, so no retry logic
 * lives here.
 */
export function subscribeToWorkbenchEvents(
  onEvent: (event: WorkbenchEvent) => void,
  onError?: (reason: string) => void
): Unsubscribe {
  const source = new EventSource('/api/events');

  function handle(message: MessageEvent<string>): void {
    const parsed = workbenchEventSchema.safeParse(safeJsonParse(message.data));
    if (parsed.success) {
      onEvent(parsed.data);
      return;
    }
    onError?.(`Unrecognised workbench event: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }

  for (const type of ['index-updated', 'test-status-changed', 'spec-changed', 'index-failed']) {
    source.addEventListener(type, handle as EventListener);
  }

  source.addEventListener('error', function onSourceError() {
    // EventSource retries on its own; surface it so the UI can show a stale badge.
    onError?.('Lost connection to the workbench server');
  });

  return function unsubscribe() {
    source.close();
  };
}

/** JSON.parse that yields undefined instead of throwing. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
