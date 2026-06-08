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
  authToken?: string;
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

export interface BootstrapResponse {
  token: string;
  visitorId: string;
  mode: WidgetMode;
  settings: WidgetSettings;
  currentUser?: ChatMember;
}

export interface ChatTab {
  tabGuid: string;
  name: string;
  order: number;
  state?: string;
  totalUnread: number;
  raw?: unknown;
}

export interface ChatSection {
  sectionGuid: string;
  name: string;
  order: number;
  icon?: string;
  totalUnread: number;
  tabs: ChatTab[];
  raw?: unknown;
}

export interface ConversationListFilters {
  section?: ChatSection;
  tab?: ChatTab;
  searchTerm?: string;
}

export type ChatContactType = 'todos' | 'usuarios' | 'pessoas' | 'whatsapp' | 'instagram';

export interface ContactListFilters {
  contactType: ChatContactType;
  searchTerm?: string;
}

export interface ChatMember {
  id?: number;
  userChatId?: number;
  name?: string;
  type?: string | number;
  number?: string;
  externalId?: string;
  raw?: unknown;
}

export interface ChatDestination {
  sectionGuid?: string;
  tabGuid?: string;
  raw?: unknown;
}

export interface ConversationSummary {
  chatGuid: string;
  title: string;
  channel?: string;
  status: ConversationStatus;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isVirtual: boolean;
  members: ChatMember[];
  destinations: ChatDestination[];
  raw?: unknown;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  size: number;
}

export interface ChatInteractiveListRow {
  id?: string;
  title?: string;
  description?: string;
}

export interface ChatInteractiveListSection {
  title?: string;
  rows: ChatInteractiveListRow[];
}

export interface ChatInteractiveList {
  headerText?: string;
  bodyText: string;
  buttonText: string;
  sections: ChatInteractiveListSection[];
}

export interface ChatMessage {
  id: string;
  chatGuid: string;
  authorType: ChatAuthorType;
  authorName?: string;
  text?: string;
  attachments?: ChatAttachment[];
  interactiveList?: ChatInteractiveList;
  createdAt: string;
  status?: string;
  raw?: unknown;
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
