import { useEffect } from 'react';
import type { IChatApi } from '../services/api/chatApi';
import { PollingRealtimeClient } from '../services/realtime/pollingRealtimeClient';
import type { ChatMessage } from '../types';

interface UseRealtimeParams {
  api: IChatApi;
  chatGuid?: string;
  intervalMs?: number;
  onMessages: (messages: ChatMessage[]) => void;
}

export function useRealtime({
  api,
  chatGuid,
  intervalMs,
  onMessages,
}: UseRealtimeParams): void {
  useEffect(() => {
    if (!chatGuid || !intervalMs) {
      return;
    }

    const realtime = new PollingRealtimeClient(api, intervalMs);
    realtime.start(chatGuid, onMessages);

    return () => realtime.stop();
  }, [api, chatGuid, intervalMs, onMessages]);
}

