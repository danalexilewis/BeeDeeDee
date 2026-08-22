import type { WorkbenchEvent } from '@eddy/behavior-contracts';

/** A connected SSE client. */
type Subscriber = {
  id: number;
  send(event: WorkbenchEvent): void;
};

/**
 * Fan-out of workbench events to connected SSE clients.
 *
 * Broadcasting is best-effort: a client whose socket has gone away is dropped
 * rather than allowed to fail the publish, so one dead browser tab cannot stall
 * the watcher that triggered the event.
 */
export type EventBus = {
  subscribe(send: (event: WorkbenchEvent) => void): () => void;
  publish(event: WorkbenchEvent): void;
  subscriberCount(): number;
};

export function createEventBus(): EventBus {
  const subscribers = new Map<number, Subscriber>();
  let nextId = 1;

  return {
    subscribe(send) {
      const id = nextId;
      nextId += 1;
      subscribers.set(id, { id, send });

      return function unsubscribe() {
        subscribers.delete(id);
      };
    },

    publish(event) {
      for (const subscriber of [...subscribers.values()]) {
        try {
          subscriber.send(event);
        } catch {
          subscribers.delete(subscriber.id);
        }
      }
    },

    subscriberCount() {
      return subscribers.size;
    },
  };
}

/** Formats an event as an SSE frame. */
export function toSseFrame(event: WorkbenchEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
