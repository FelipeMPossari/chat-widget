import { HttpChatApi } from './HttpChatApi';
import { MockChatApi } from './MockChatApi';
import type { ChatApi } from './ChatApi';
import type { ChatWidgetConfig } from '../types';

export function createChatApi(config: ChatWidgetConfig): ChatApi {
  if (config.demoMode || !config.apiBaseUrl) {
    return new MockChatApi();
  }

  return new HttpChatApi(config.apiBaseUrl);
}

