export type WidgetPosition = 'left' | 'right';

export type WidgetMode = 'anonymous' | 'authenticated';

export type ConversationStatus = 'open' | 'closed';

export type ChatAuthorType = 'visitor' | 'agent' | 'system';

export interface WidgetUserContext {
  externalUserId?: string;
  name?: string;
  email?: string;
  token?: string;
}

export interface ChatWidgetConfig {
  widgetKey: string;
  apiBaseUrl?: string;
  demoMode: boolean;
  locale: string;
  position: WidgetPosition;
  sourceSystem?: string;
  sourceUrl: string;
  user?: WidgetUserContext;
}

export interface WidgetSettings {
  title: string;
  subtitle: string;
  themeColor: string;
  requireIdentity: boolean;
  allowAttachments: boolean;
  allowMultipleConversations: boolean;
  pollingIntervalMs: number;
}

export interface BootstrapRequest {
  widgetKey: string;
  visitorId: string;
  sourceSystem?: string;
  sourceUrl: string;
  user?: WidgetUserContext;
}

export interface BootstrapResponse {
  token: string;
  visitorId: string;
  mode: WidgetMode;
  settings: WidgetSettings;
}

export interface ConversationSummary {
  chatGuid: string;
  title: string;
  status: ConversationStatus;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  chatGuid: string;
  authorType: ChatAuthorType;
  authorName?: string;
  text?: string;
  attachments?: ChatAttachment[];
  createdAt: string;
}

export interface CreateConversationRequest {
  subject?: string;
  visitorName?: string;
  visitorEmail?: string;
}

export interface SendMessageRequest {
  text: string;
}

export interface UploadAttachmentRequest {
  file: File;
}

export interface WidgetController {
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    XChannelWebChat?: {
      init: (options?: Partial<ChatWidgetConfig>) => HTMLElement;
      open: () => void;
      close: () => void;
      toggle: () => void;
      destroy: () => void;
    };
  }
}

