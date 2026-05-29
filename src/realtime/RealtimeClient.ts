import type { ChatApi } from '../api/ChatApi';
import type { ChatMessage } from '../types';

export interface RealtimeClient {
  start: (chatGuid: string, onMessages: (messages: ChatMessage[]) => void) => void;
  stop: () => void;
}

export class PollingRealtimeClient implements RealtimeClient {
  private timerId = 0;
  private knownMessageIds = new Set<string>();

  constructor(
    private readonly api: ChatApi,
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

