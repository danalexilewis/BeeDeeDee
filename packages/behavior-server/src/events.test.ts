import { workbenchEventSchema, type WorkbenchEvent } from '@eddy/behavior-contracts';
import { describe, expect, it } from 'vitest';
import { createEventBus, toSseFrame } from './events.js';

const AT = '2026-07-29T10:00:00.000Z';

const INDEX_UPDATED: WorkbenchEvent = {
  type: 'index-updated',
  at: AT,
  featureCount: 2,
  scenarioCount: 5,
};

describe('createEventBus', () => {
  it('delivers an event to a subscriber', () => {
    const bus = createEventBus();
    const received: WorkbenchEvent[] = [];
    bus.subscribe(event => received.push(event));

    bus.publish(INDEX_UPDATED);
    expect(received).toEqual([INDEX_UPDATED]);
  });

  it('delivers to every subscriber', () => {
    const bus = createEventBus();
    let first = 0;
    let second = 0;
    bus.subscribe(() => (first += 1));
    bus.subscribe(() => (second += 1));

    bus.publish(INDEX_UPDATED);
    expect([first, second]).toEqual([1, 1]);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus();
    const received: WorkbenchEvent[] = [];
    const unsubscribe = bus.subscribe(event => received.push(event));

    unsubscribe();
    bus.publish(INDEX_UPDATED);
    expect(received).toEqual([]);
    expect(bus.subscriberCount()).toBe(0);
  });

  it('tracks the subscriber count', () => {
    const bus = createEventBus();
    expect(bus.subscriberCount()).toBe(0);

    const first = bus.subscribe(() => {});
    bus.subscribe(() => {});
    expect(bus.subscriberCount()).toBe(2);

    first();
    expect(bus.subscriberCount()).toBe(1);
  });

  it('drops a subscriber whose socket has gone away and keeps serving the rest', () => {
    // One dead browser tab must not stall the watcher that published the event.
    const bus = createEventBus();
    const healthy: WorkbenchEvent[] = [];

    bus.subscribe(() => {
      throw new Error('EPIPE');
    });
    bus.subscribe(event => healthy.push(event));

    expect(() => bus.publish(INDEX_UPDATED)).not.toThrow();
    expect(healthy).toEqual([INDEX_UPDATED]);
    expect(bus.subscriberCount()).toBe(1);
  });

  it('publishing with no subscribers is harmless', () => {
    const bus = createEventBus();
    expect(() => bus.publish(INDEX_UPDATED)).not.toThrow();
  });
});

describe('toSseFrame', () => {
  it('names the event and encodes the payload as JSON', () => {
    const frame = toSseFrame(INDEX_UPDATED);
    expect(frame).toBe(`event: index-updated\ndata: ${JSON.stringify(INDEX_UPDATED)}\n\n`);
  });

  it('terminates the frame with a blank line', () => {
    expect(toSseFrame(INDEX_UPDATED).endsWith('\n\n')).toBe(true);
  });

  it('produces a payload that parses back to a valid event', () => {
    const frame = toSseFrame(INDEX_UPDATED);
    const data = frame.split('data: ')[1]!.trim();
    expect(workbenchEventSchema.parse(JSON.parse(data))).toEqual(INDEX_UPDATED);
  });

  it.each([
    { type: 'test-status-changed', at: AT, scenarioId: 'login.happy', status: 'fail' },
    { type: 'spec-changed', at: AT, path: 'a.feature', change: 'changed' },
    { type: 'index-failed', at: AT, error: { tag: 'ReadFailed', message: 'nope' } },
  ] as WorkbenchEvent[])('round-trips a $type event', event => {
    const data = toSseFrame(event).split('data: ')[1]!.trim();
    expect(workbenchEventSchema.parse(JSON.parse(data))).toEqual(event);
  });
});
