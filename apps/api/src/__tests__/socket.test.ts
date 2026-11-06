import { describe, expect, it } from 'vitest';
import {
  ClientEvents,
  ServerEvents,
  clientToServerSchemas,
  dashboardUpdatedSchema,
  recallStateSchema,
  serverEventSchemas,
} from './socket-contract';

describe('socket event contract', () => {
  it('covers every documented event', () => {
    expect(Object.values(ServerEvents).sort()).toEqual(
      [
        'dashboard:updated',
        'explain:analyzing',
        'explain:result',
        'explain:transcript',
        'file:done',
        'file:error',
        'file:processing',
        'file:progress',
        'recall:finished',
        'recall:flagResult',
        'recall:start',
        'recall:state',
      ].sort(),
    );
    expect(Object.values(ClientEvents)).toEqual(['recall:resume']);
  });

  it('has a validating schema for every server event', () => {
    for (const event of Object.values(ServerEvents)) {
      expect(serverEventSchemas[event]).toBeDefined();
    }
    for (const event of Object.values(ClientEvents)) {
      expect(clientToServerSchemas[event]).toBeDefined();
    }
  });

  it('never carries a user id in a payload', () => {
    const parsed = dashboardUpdatedSchema.parse({ reason: 'explain', userId: 'leak' });
    expect(parsed).not.toHaveProperty('userId');
    const state = recallStateSchema.parse({
      roundId: 'r1',
      status: 'active',
      placeId: 'p1',
      timePerFlagSec: 20,
      startedAt: new Date().toISOString(),
      results: [{ flagId: 'f1', outcome: 'green', msTaken: 1200 }],
    });
    expect(Object.keys(state)).not.toContain('userId');
  });

  it('rejects malformed payloads', () => {
    expect(() => serverEventSchemas['file:progress'].parse({ topicId: 't', fileId: 'f', progress: 140, stage: 'x' })).toThrow();
    expect(() => serverEventSchemas['recall:start'].parse({ roundId: 'r', placeId: 'p', flagCount: 0, timePerFlagSec: 20 })).toThrow();
    expect(() => serverEventSchemas['explain:result'].parse({ topicId: 't', explanationId: 'e' })).toThrow();
  });

  it('accepts the streamed explain result shape', () => {
    const point = serverEventSchemas['explain:result'].parse({
      topicId: 't1',
      explanationId: 'e1',
      final: false,
      point: { keyPointId: 2, verdict: 'partial', evidence: 'it fixes CO2', feedback: 'Add the product' },
    });
    expect(point.point?.verdict).toBe('partial');
    const final = serverEventSchemas['explain:result'].parse({
      topicId: 't1',
      explanationId: 'e1',
      final: true,
      score: 67,
      passed: false,
      summary: 'Close.',
      gaps: [2],
      fallback: false,
    });
    expect(final.score).toBe(67);
  });
});
