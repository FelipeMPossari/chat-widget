import type { WidgetUserContext } from './index';

export type XChannelChatChannel = 'chat' | 'whatsapp' | 'instagram' | 'webwidget';

export interface BootstrapRequest {
  widgetKey: string;
  visitorId: string;
  sourceSystem?: string;
  sourceUrl: string;
  user?: WidgetUserContext;
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

export interface XChannelChatMemberDto {
  Id?: number;
  id?: number;
  UserChatId?: number;
  userChatId?: number;
  Name?: string;
  name?: string;
  Type?: string | number;
  type?: string | number;
  Number?: string;
  number?: string;
  ExternalId?: string;
  externalId?: string;
}

export interface XChannelChatDestinationDto {
  SectionGuid?: string;
  sectionGuid?: string;
  TabGuid?: string;
  tabGuid?: string;
}

export interface XChannelChatListItemDto {
  IDUserBroadcast?: number;
  idUserBroadcast?: number;
  ChatGuid?: string;
  chatGuid?: string;
  Title?: string;
  title?: string;
  Channel?: XChannelChatChannel | string;
  channel?: XChannelChatChannel | string;
  Type?: string;
  type?: string;
  Status?: string;
  status?: string;
  LastMessage?: string;
  lastMessage?: string;
  LastMessageIsDeleted?: boolean;
  lastMessageIsDeleted?: boolean;
  DateLastMessage?: string;
  dateLastMessage?: string;
  CreatedAt?: string;
  createdAt?: string;
  LastMessageAt?: string;
  lastMessageAt?: string;
  QuantityUnreadMessages?: number;
  quantityUnreadMessages?: number;
  UnreadCount?: number;
  unreadCount?: number;
  System?: XChannelChatChannel | string;
  system?: XChannelChatChannel | string;
  Destinations?: XChannelChatDestinationDto[];
  destinations?: XChannelChatDestinationDto[];
  Members?: XChannelChatMemberDto[];
  members?: XChannelChatMemberDto[];
}

export interface XChannelChatAttachmentDto {
  Guid?: string;
  guid?: string;
  AttachmentGuid?: string;
  attachmentGuid?: string;
  FileName?: string;
  fileName?: string;
  Name?: string;
  name?: string;
  MimeType?: string;
  mimeType?: string;
  ContentType?: string;
  contentType?: string;
  Url?: string;
  url?: string;
  SizeBytes?: number;
  sizeBytes?: number;
  Size?: number;
  size?: number;
}

export interface XChannelChatInteractiveListItemDto {
  Id?: string;
  id?: string;
  Title?: string;
  title?: string;
  Description?: string;
  description?: string;
}

export interface XChannelChatInteractiveListSectionDto {
  Title?: string;
  title?: string;
  Items?: XChannelChatInteractiveListItemDto[];
  items?: XChannelChatInteractiveListItemDto[];
}

export interface XChannelChatInteractiveListDto {
  Title?: string;
  title?: string;
  Body?: string;
  body?: string;
  ButtonText?: string;
  buttonText?: string;
  Sections?: XChannelChatInteractiveListSectionDto[];
  sections?: XChannelChatInteractiveListSectionDto[];
}

export interface XChannelMessageDto {
  MessageGuid?: string;
  messageGuid?: string;
  ChatGuid?: string;
  chatGuid?: string;
  SenderUser?: XChannelChatMemberDto;
  senderUser?: XChannelChatMemberDto;
  Body?: string;
  body?: string;
  CreatedAt?: string;
  createdAt?: string;
  DeletedAt?: string;
  deletedAt?: string;
  EditedAt?: string;
  editedAt?: string;
  IsDeleted?: boolean;
  isDeleted?: boolean;
  IsEdited?: boolean;
  isEdited?: boolean;
  Status?: string;
  status?: string;
  Attachment?: XChannelChatAttachmentDto;
  attachment?: XChannelChatAttachmentDto;
  Attachments?: XChannelChatAttachmentDto[];
  attachments?: XChannelChatAttachmentDto[];
  InteractiveList?: XChannelChatInteractiveListDto;
  interactiveList?: XChannelChatInteractiveListDto;
  Error?: unknown;
  error?: unknown;
}

export interface XChannelMessageStatusUpdateDto {
  ChatGuid?: string;
  chatGuid?: string;
  MessageGuid?: string;
  messageGuid?: string;
  Status?: string;
  status?: string;
}
