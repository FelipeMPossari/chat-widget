import type { ChatMessage } from '../../types';

export interface IRealtimeClient {
  start: (chatGuid: string, onMessages: (messages: ChatMessage[]) => void) => void;
  stop: () => void;
}

