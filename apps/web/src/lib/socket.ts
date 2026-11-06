import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@pinpoint/shared';
import { tokenStore } from './api';

export type PinpointSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

let socket: PinpointSocket | null = null;
let status: ConnectionStatus = 'offline';
const listeners = new Set<(status: ConnectionStatus) => void>();

function setStatus(next: ConnectionStatus): void {
  status = next;
  for (const listener of listeners) listener(next);
}

export function subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getStatus(): ConnectionStatus {
  return status;
}

/** One typed socket for the whole app; reconnects on its own and re-auths. */
export function connectSocket(): PinpointSocket {
  const token = tokenStore.get();
  if (socket) {
    if (token) socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  setStatus('connecting');
  socket = io('/', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  }) as PinpointSocket;

  socket.on('connect', () => setStatus('connected'));
  socket.on('disconnect', (reason) => {
    setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
  });
  socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
  socket.io.on('reconnect_failed', () => setStatus('offline'));
  socket.on('connect_error', () => setStatus('offline'));

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  setStatus('offline');
}
