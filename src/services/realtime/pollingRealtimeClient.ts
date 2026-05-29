import type { IChatApi } from '../api/chatApi';
import type { ChatMessage } from '../../types';
import type { IRealtimeClient } from './IRealtimeClient';

export class PollingRealtimeClient implements IRealtimeClient {
  private timerId = 0;
  private knownMessageIds = new Set<string>();

  constructor(
    private readonly api: IChatApi,
    private readonly intervalMs: number
  ) {}

  start(chatGuid: string, onMessages: (messages: ChatMessage[]) => void): void {
    this.stop();
    this.knownMessageIds.clear();

    const poll = async () => {
      const messages = await this.api.listMessages(chatGuid).catch(() => []);
      const hasNewMessages = messages.some((message) => !this.knownMessageIds.has(message.id));

      if (hasNewMessages || this.knownMessageIds.size === 0) {
        this.knownMessageIds = new Set(messages.map((message) => message.id));
        onMessages(messages);
      }
    };

    void poll();
    this.timerId = window.setInterval(poll, this.intervalMs);
  }

  stop(): void {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = 0;
    }
  }
}

