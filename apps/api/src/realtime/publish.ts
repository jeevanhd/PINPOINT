import type { ServerEventName, ServerToClientEvents } from '@pinpoint/shared';
import { serverEventSchemas } from '@pinpoint/shared';
import { getRedisPublisher } from '../lib/redis';
import { logger } from '../config/logger';
import { emitLocalEvent, type EventEnvelope } from './bus';

export const EVENT_CHANNEL = 'pinpoint:events';

type PayloadOf<E extends ServerEventName> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Every outbound socket payload is validated against the shared contract
 * before it leaves the process, so a worker can never push a shape the client
 * does not understand.
 */
export async function publish<E extends ServerEventName>(
  room: string,
  event: E,
  payload: PayloadOf<E>,
): Promise<void> {
  const parsed = serverEventSchemas[event].safeParse(payload);
  if (!parsed.success) {
    logger.error({ event, issues: parsed.error.issues }, 'refusing to emit invalid socket payload');
    return;
  }
  const envelope: EventEnvelope = { room, event, payload: parsed.data };
  const publisher = getRedisPublisher();
  if (publisher) {
    try {
      await publisher.publish(EVENT_CHANNEL, JSON.stringify(envelope));
      return;
    } catch (err) {
      logger.warn({ err }, 'redis publish failed, falling back to local emit');
    }
  }
  emitLocalEvent(envelope);
}

export async function publishToUser<E extends ServerEventName>(
  userId: string,
  event: E,
  payload: PayloadOf<E>,
): Promise<void> {
  await publish(`user:${userId}`, event, payload);
}
