import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ClientToServerEvents, RecallStatePayload, ServerToClientEvents } from '@pinpoint/shared';
import { env, redisEnabled } from '../config/env';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../lib/jwt';
import { getRedisPublisher, getRedisSubscriber } from '../lib/redis';
import { onLocalEvent, type EventEnvelope } from './bus';
import { EVENT_CHANNEL } from './publish';

export type PinpointIo = Server<ClientToServerEvents, ServerToClientEvents>;

let io: PinpointIo | null = null;
let resumeHandler: ((userId: string, roundId: string) => Promise<RecallStatePayload | null>) | null =
  null;

export function getIo(): PinpointIo {
  if (!io) throw new Error('Socket.IO server not initialised');
  return io;
}

export function setRecallResumeHandler(
  handler: (userId: string, roundId: string) => Promise<RecallStatePayload | null>,
): void {
  resumeHandler = handler;
}

function deliver(envelope: EventEnvelope): void {
  if (!io) return;
  // Typed at the contract level already; the emitter needs a single shape here.
  const target = io.to(envelope.room) as unknown as {
    emit: (event: string, payload: unknown) => void;
  };
  target.emit(envelope.event, envelope.payload);
}

export async function createIo(server: HttpServer): Promise<PinpointIo> {
  const instance: PinpointIo = new Server(server, {
    cors: { origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()), credentials: true },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  if (redisEnabled) {
    const pub = getRedisPublisher();
    const sub = getRedisSubscriber();
    if (pub && sub) {
      instance.adapter(createAdapter(pub, sub));
      await sub.subscribe(EVENT_CHANNEL);
      sub.on('message', (channel, message) => {
        if (channel !== EVENT_CHANNEL) return;
        try {
          deliver(JSON.parse(message) as EventEnvelope);
        } catch (err) {
          logger.warn({ err }, 'bad socket envelope from redis');
        }
      });
    }
  }
  onLocalEvent(deliver);

  // JWT is verified in the handshake. The client never tells us who it is.
  instance.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('unauthorized'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  instance.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(`user:${userId}`);
    logger.debug({ userId, socketId: socket.id }, 'socket connected');

    socket.on('recall:resume', async (raw, ack) => {
      if (!resumeHandler) {
        ack?.(null);
        return;
      }
      const roundId = typeof raw?.roundId === 'string' ? raw.roundId : '';
      if (!roundId) {
        ack?.(null);
        return;
      }
      try {
        const state = await resumeHandler(userId, roundId);
        if (state) await socket.emit('recall:state', state);
        ack?.(state);
      } catch (err) {
        logger.warn({ err }, 'recall resume failed');
        ack?.(null);
      }
    });
  });

  io = instance;
  return instance;
}

export async function closeIo(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
}
