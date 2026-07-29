import { workbenchEventSchema, type WorkbenchEvent } from '@eddy/behavior-contracts';

/** Stops an event subscription. */
export type Unsubscribe = () => void;

export type WorkbenchEventHandlers = {
  onEvent: (event: WorkbenchEvent) => void;
  /**
   * Called when the stream opens.
   *
   * Connection state must come from `open`, not from the first event: a healthy
   * but quiet server would otherwise report as offline until something happened
   * to change.
   */
  onOpen?: () => void;
  onError?: (reason: string) => void;
};

/**
 * Subscribes to workbench events over SSE.
 *
 * Payloads are validated with the same schema the server publishes, so a
 * mismatched deploy is reported rather than silently producing a malformed
 * update. The browser reconnects an EventSource automatically, so no retry logic
 * lives here.
 */
export function subscribeToWorkbenchEvents(handlers: WorkbenchEventHandlers): Unsubscribe {
  const source = new EventSource('/api/events');

  function handle(message: MessageEvent<string>): void {
    const parsed = workbenchEventSchema.safeParse(safeJsonParse(message.data));
    if (parsed.success) {
      handlers.onEvent(parsed.data);
      return;
    }
    handlers.onError?.(
      `Unrecognised workbench event: ${parsed.error.issues[0]?.message ?? 'invalid'}`
    );
  }

  for (const type of ['index-updated', 'test-status-changed', 'spec-changed', 'index-failed']) {
    source.addEventListener(type, handle as EventListener);
  }

  source.addEventListener('open', function onSourceOpen() {
    handlers.onOpen?.();
  });

  source.addEventListener('error', function onSourceError() {
    // EventSource retries on its own; surface it so the UI can show a stale badge.
    handlers.onError?.('Lost connection to the workbench server');
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
