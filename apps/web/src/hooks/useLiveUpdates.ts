import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { serverEventSchemas, type ServerEventName } from '@pinpoint/shared';
import { connectSocket } from '../lib/socket';
import { queryKeys } from '../lib/query';

/**
 * Wires the shared socket contract into React Query. Payloads are validated
 * on arrival, so a stray event cannot corrupt the cache.
 */
export function useLiveUpdates(handlers?: Partial<Record<ServerEventName, (payload: unknown) => void>>) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();
    const unsubscribers: (() => void)[] = [];

    const on = (event: ServerEventName) => {
      const handler = (raw: unknown) => {
        const parsed = serverEventSchemas[event].safeParse(raw);
        if (!parsed.success) return;
        handlers?.[event]?.(parsed.data);
        if (event === 'dashboard:updated') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
        }
        if (event === 'explain:result') {
          const payload = parsed.data as { topicId: string };
          void queryClient.invalidateQueries({ queryKey: queryKeys.topic(payload.topicId) });
        }
      };
      socket.on(event as never, handler as never);
      unsubscribers.push(() => socket.off(event as never, handler as never));
    };

    for (const event of Object.keys(serverEventSchemas) as ServerEventName[]) on(event);

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
    // Handlers are read once per mount on purpose: the socket listeners are
    // re-registered only when the query client changes.
  }, [queryClient]);
}
