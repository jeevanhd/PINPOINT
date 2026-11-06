import { EventEmitter } from 'node:events';
import type { ServerEventName } from '@pinpoint/shared';

export interface EventEnvelope {
  room: string;
  event: ServerEventName;
  payload: unknown;
}

/**
 * In-process fallback for when Redis is not configured. With Redis, the same
 * envelope travels over a pub/sub channel so the worker process can reach
 * sockets held by the API process.
 */
const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitLocalEvent(envelope: EventEnvelope): void {
  bus.emit('event', envelope);
}

export function onLocalEvent(listener: (envelope: EventEnvelope) => void): void {
  bus.on('event', listener);
}
