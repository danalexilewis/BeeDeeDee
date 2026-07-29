import { createFixedClock } from '@eddy/behavior-core';
import { describe, expect, it } from 'vitest';
import { createAuditLog, summariseInput, type AuditEntry } from './audit.js';

describe('summariseInput', () => {
  it('leaves short values intact', () => {
    expect(summariseInput({ scenarioId: 'login.happy' })).toEqual({ scenarioId: 'login.happy' });
  });

  it('truncates a long string and states its original length', () => {
    const long = 'x'.repeat(500);
    const summary = summariseInput({ gherkin: long });

    expect(String(summary['gherkin']).length).toBeLessThan(long.length);
    expect(summary['gherkin']).toContain('(500 chars)');
  });

  it('passes non-string values through', () => {
    expect(summariseInput({ limit: 20, flag: true })).toEqual({ limit: 20, flag: true });
  });

  it('handles no arguments', () => {
    expect(summariseInput({})).toEqual({});
  });
});

describe('createAuditLog', () => {
  it('timestamps entries from the clock', () => {
    const log = createAuditLog({ clock: createFixedClock('2026-03-04T05:06:07.000Z') });
    log.record({ tool: 'describe_project', input: {}, outcome: 'ok' });

    expect(log.entries()[0]!.at).toBe('2026-03-04T05:06:07.000Z');
  });

  it('records the outcome and detail', () => {
    const log = createAuditLog({ clock: createFixedClock() });
    log.record({ tool: 'x', input: {}, outcome: 'error', detail: 'went wrong' });

    expect(log.entries()[0]).toMatchObject({ outcome: 'error', detail: 'went wrong' });
  });

  it('omits detail when none was given', () => {
    const log = createAuditLog({ clock: createFixedClock() });
    log.record({ tool: 'x', input: {}, outcome: 'ok' });

    expect(Object.hasOwn(log.entries()[0]!, 'detail')).toBe(false);
  });

  it('distinguishes a denied write from an error', () => {
    const log = createAuditLog({ clock: createFixedClock() });
    log.record({ tool: 'append_scenario', input: {}, outcome: 'denied', detail: 'writes off' });

    expect(log.entries()[0]!.outcome).toBe('denied');
  });

  it('forwards each entry to the sink', () => {
    const seen: AuditEntry[] = [];
    const log = createAuditLog({ clock: createFixedClock(), sink: entry => seen.push(entry) });

    log.record({ tool: 'a', input: {}, outcome: 'ok' });
    log.record({ tool: 'b', input: {}, outcome: 'ok' });

    expect(seen.map(entry => entry.tool)).toEqual(['a', 'b']);
  });

  it('drops the oldest entries once the limit is reached', () => {
    const log = createAuditLog({ clock: createFixedClock(), limit: 2 });

    log.record({ tool: 'first', input: {}, outcome: 'ok' });
    log.record({ tool: 'second', input: {}, outcome: 'ok' });
    log.record({ tool: 'third', input: {}, outcome: 'ok' });

    expect(log.entries().map(entry => entry.tool)).toEqual(['second', 'third']);
  });

  it('summarises input as it records', () => {
    const log = createAuditLog({ clock: createFixedClock() });
    log.record({ tool: 'x', input: { gherkin: 'y'.repeat(400) }, outcome: 'ok' });

    expect(String(log.entries()[0]!.input['gherkin'])).toContain('(400 chars)');
  });
});
